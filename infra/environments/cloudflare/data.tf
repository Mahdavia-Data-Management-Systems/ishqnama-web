data "cloudflare_zone" "ishqnama" {
  filter = {
    name = "ishqnama.com"
  }
}