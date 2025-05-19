resource "aws_s3_bucket" "spa_bucket" {
  bucket = var.domain_name
}

resource "aws_s3_bucket_acl" "spa_bucket_acl" {
  bucket = aws_s3_bucket.spa_bucket.id
  acl    = "private"
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

  base_dir = "${path.module}/../build/client"
}

resource "aws_s3_object" "spa_files" {
  for_each = module.spa_files.files

  bucket       = aws_s3_bucket.spa_bucket.bucket
  key          = each.key
  source       = each.value.source_path
  etag         = each.value.digests.md5
  content_type = each.value.content_type
}

resource "aws_acm_certificate" "ssl_certificate" {
  provider          = aws.us-east-1
  domain_name       = var.domain_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_acm_certificate_validation" "ssl_certificate_validation" {
  provider                = aws.us-east-1
  certificate_arn         = aws_acm_certificate.ssl_certificate.arn
  validation_record_fqdns = [for record in aws_route53_record.ssl_certificate_validation_domains : record.fqdn]
}

resource "aws_route53_record" "ssl_certificate_validation_domains" {
  for_each = {
    for dvo in aws_acm_certificate.ssl_certificate.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  type            = each.value.type
  records         = [each.value.record]
  ttl             = 60
  zone_id         = data.aws_route53_zone.ruchij_zone.id
}

resource "aws_cloudfront_distribution" "spa_cf" {
  enabled = true

  aliases             = [var.domain_name]
  default_root_object = "index.html"

  default_cache_behavior {
    allowed_methods        = ["HEAD", "GET"]
    cached_methods         = ["HEAD", "GET"]
    target_origin_id       = aws_s3_bucket.spa_bucket.id
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = true

      cookies {
        forward = "all"
      }
    }
  }

  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  origin {
    domain_name = aws_s3_bucket.spa_bucket.bucket_domain_name
    origin_id   = aws_s3_bucket.spa_bucket.id
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn = aws_acm_certificate.ssl_certificate.arn
    ssl_support_method  = "sni-only"
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