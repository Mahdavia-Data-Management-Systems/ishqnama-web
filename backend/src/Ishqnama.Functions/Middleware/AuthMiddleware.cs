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

        var path = httpContext.Request.Path;
        var isProtectedRoute = path.StartsWithSegments("/api/user") || path.StartsWithSegments("/api/search");

        var authHeader = httpContext.Request.Headers.Authorization.ToString();
        var hasBearer = !string.IsNullOrEmpty(authHeader) &&
                        authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase);

        if (!isProtectedRoute && !hasBearer)
        {
            // No auth needed, no token present — proceed anonymously
            await next(context);
            return;
        }

        if (!hasBearer)
        {
            // Protected route without token — 401
            httpContext.Response.StatusCode = 401;
            await httpContext.Response.WriteAsJsonAsync(new { error = "Missing or invalid Authorization header." });
            return;
        }

        var token = authHeader!["Bearer ".Length..].Trim();
        var (isValid, userId) = await ValidateTokenAsync(token);

        if (isValid && !string.IsNullOrEmpty(userId))
        {
            httpContext.Items["UserId"] = userId;
            httpContext.Items["IsAuthenticated"] = true;
        }
        else if (isProtectedRoute)
        {
            // Protected route with invalid token — 401
            httpContext.Response.StatusCode = 401;
            await httpContext.Response.WriteAsJsonAsync(new { error = "Invalid token." });
            return;
        }
        // else: non-protected route with invalid token — proceed anonymously

        await next(context);
    }

    private async Task<(bool IsValid, string? UserId)> ValidateTokenAsync(string token)
    {
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
                return (false, null);

            var userId = result.Claims.TryGetValue("oid", out var oid) ? oid?.ToString()
                : result.Claims.TryGetValue("sub", out var sub) ? sub?.ToString()
                : null;

            return string.IsNullOrEmpty(userId) ? (false, null) : (true, userId);
        }
        catch (SecurityTokenException ex)
        {
            _logger.LogWarning(ex, "Token validation failed");
            return (false, null);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "Unexpected error during token validation");
            return (false, null);
        }
    }
}
