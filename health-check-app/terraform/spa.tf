resource "aws_s3_bucket" "spa_bucket" {
  bucket = var.domain_name
}

resource "aws_s3_bucket_acl" "spa_bucket_acl" {
  bucket = aws_s3_bucket.spa_bucket.id
  acl    = "private"
}

resource "aws_s3_bucket_website_configuration" "spa_website" {
  bucket = aws_s3_bucket.spa_bucket.bucket

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "index.html"

  }
}

resource "aws_s3_bucket_policy" "spa_bucket_policy" {
  bucket = aws_s3_bucket.spa_bucket.bucket
  policy = jsonencode({
    Version   = "2012-10-17",
    Statement = [
      {
        Effect    = "Allow",
        Action    = ["s3:getObject"],
        Resource  = "${aws_s3_bucket.spa_bucket.arn}/*",
        Principal = "*"
      }
    ]
  })
}

module "spa_files" {
  source = "hashicorp/dir/template"

  base_dir = "${path.module}/../build"
}

resource "aws_s3_object" "spa_files" {
  for_each = module.spa_files.files

  bucket       = aws_s3_bucket.spa_bucket.bucket
  key          = each.key
  source       = each.value.source_path
  etag         = each.value.digests.md5
  content_type = each.value.content_type
}

resource "aws_cloudfront_distribution" "spa_cf" {
  enabled = true

  aliases = [ var.domain_name ]

  default_cache_behavior {
    allowed_methods        = ["HEAD", "GET", "OPTIONS"]
    cached_methods         = ["HEAD", "GET", "OPTIONS"]
    target_origin_id       = aws_s3_bucket.spa_bucket.id
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = true

      cookies {
        forward = "none"
      }
    }
  }

  custom_error_response {
    error_code = 404
    response_code = 200
    response_page_path = "/"
  }

  origin {
    domain_name = aws_s3_bucket.spa_bucket.website_endpoint
    origin_id   = aws_s3_bucket.spa_bucket.id

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1", "TLSv1.1", "TLSv1.2"]
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn = local.certificate_arn
    ssl_support_method = "sni-only"
  }
}

data "aws_route53_zone" "ruchij_zone" {
  name = "ruchij.com"
}

resource "aws_route53_record" "spa_route53_record" {
  name    = var.domain_name
  type    = "A"
  zone_id = data.aws_route53_zone.ruchij_zone.id

  alias {
    evaluate_target_health = false
    name                   = aws_cloudfront_distribution.spa_cf.domain_name
    zone_id                = aws_cloudfront_distribution.spa_cf.hosted_zone_id
  }
}