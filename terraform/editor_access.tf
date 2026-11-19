resource "aws_cloudfront_public_key" "editor" {
  name        = "vkp-editor"
  comment     = "Signs cookies for /editor/*"
  encoded_key = file("${path.module}/editor-signing-public.pem")
}

resource "aws_cloudfront_key_group" "editor" {
  name    = "vkp-editor"
  comment = "Campaign editor signed cookies"
  items   = [aws_cloudfront_public_key.editor.id]
}
