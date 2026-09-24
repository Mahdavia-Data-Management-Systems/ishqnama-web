import baseManifest from "../../public/manifest.json";

/**
 * Domain whose subdomains identify a deployment environment, e.g. dev.ishqnama.com is dev.
 * The apex and www are production and keep the plain name.
 */
const ENVIRONMENT_DOMAIN = "ishqnama.com";

/**
 * Inline script for the document head that names the PWA after the environment it is
 * installed from. It must run synchronously in the head, before the browser reads the
 * manifest for an install prompt.
 *
 * The name is derived from location.hostname rather than fixed at build time, so any
 * environment subdomain gets its suffix while the prod hosts (ishqnama.com and
 * www.ishqnama.com) keep the plain name. On an environment host the script swaps the static
 * /manifest.json link for a data: URL holding the same manifest with the suffixed name
 * (relative URLs cannot be resolved against a data: URL, so they are made absolute) and
 * sets apple-mobile-web-app-title for iOS, which does not read the manifest name for
 * "Add to Home Screen" on every version. On production hosts it does nothing.
 */
export function pwaManifestScript(): string {
  const manifestJson = JSON.stringify(baseManifest);
  return `(function(){
var m=/^([^.]+)\.${ENVIRONMENT_DOMAIN.replace(".", "\\.")}$/i.exec(location.hostname);
if(!m||m[1].toLowerCase()==="www")return;
var label=m[1];
var base=${manifestJson};
var name=base.name+" - "+label.charAt(0).toUpperCase()+label.slice(1).toLowerCase();
var origin=location.origin;
var manifest=Object.assign({},base,{
name:name,
short_name:name,
start_url:origin+base.start_url,
icons:(base.icons||[]).map(function(i){return Object.assign({},i,{src:origin+i.src});})
});
var link=document.querySelector('link[rel="manifest"]');
if(!link){link=document.createElement("link");link.rel="manifest";document.head.appendChild(link);}
link.href="data:application/manifest+json,"+encodeURIComponent(JSON.stringify(manifest));
var meta=document.querySelector('meta[name="apple-mobile-web-app-title"]');
if(!meta){meta=document.createElement("meta");meta.name="apple-mobile-web-app-title";document.head.appendChild(meta);}
meta.content=name;
})();`;
}
