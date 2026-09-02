using Microsoft.AspNetCore.Http;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Middleware;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;

namespace Ishqnama.Functions.Middleware;

public sealed class AuthMiddleware : IFunctionsWorkerMiddleware
{
    private readonly string _clientId;
    private readonly ConfigurationManager<OpenIdConnectConfiguration> _configManager;
    private readonly ILogger<AuthMiddleware> _logger;

    public AuthMiddleware(IConfiguration configuration, ILogger<AuthMiddleware> logger)
    {
        _logger = logger;
        _clientId = configuration["Auth:ClientId"] ?? "";
        var authority = configuration["Auth:Authority"] ?? "";

        _configManager = new ConfigurationManager<OpenIdConnectConfiguration>(
            $"{authority}/.well-known/openid-configuration",
            new OpenIdConnectConfigurationRetriever(),
            new HttpDocumentRetriever());
    }

    public async Task Invoke(FunctionContext context, FunctionExecutionDelegate next)
    {
        var httpContext = context.GetHttpContext();
        if (httpContext is null)
        {
            await next(context);
            return;
        }

        // Only protect /api/user/* routes
        if (!httpContext.Request.Path.StartsWithSegments("/api/user"))
        {
            await next(context);
            return;
        }

        var authHeader = httpContext.Request.Headers.Authorization.ToString();
        if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            httpContext.Response.StatusCode = 401;
            await httpContext.Response.WriteAsJsonAsync(new { error = "Missing or invalid Authorization header." });
            return;
        }

        var token = authHeader["Bearer ".Length..].Trim();

        try
        {
            var oidcConfig = await _configManager.GetConfigurationAsync(CancellationToken.None);

            var validationParams = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidIssuer = oidcConfig.Issuer,
                ValidateAudience = true,
                ValidAudience = _clientId,
                ValidateLifetime = true,
                IssuerSigningKeys = oidcConfig.SigningKeys,
                ValidateIssuerSigningKey = true
            };

            var handler = new JsonWebTokenHandler();
            var result = await handler.ValidateTokenAsync(token, validationParams);

            if (!result.IsValid)
                throw result.Exception;

            var userId = result.Claims.TryGetValue("oid", out var oid) ? oid?.ToString()
                : result.Claims.TryGetValue("sub", out var sub) ? sub?.ToString()
                : null;

            if (string.IsNullOrEmpty(userId))
            {
                httpContext.Response.StatusCode = 401;
                await httpContext.Response.WriteAsJsonAsync(new { error = "Token missing user identifier." });
                return;
            }

            httpContext.Items["UserId"] = userId;
        }
        catch (SecurityTokenException ex)
        {
            _logger.LogWarning(ex, "Token validation failed");
            httpContext.Response.StatusCode = 401;
            await httpContext.Response.WriteAsJsonAsync(new { error = "Invalid token." });
            return;
        }

        await next(context);
    }
}
