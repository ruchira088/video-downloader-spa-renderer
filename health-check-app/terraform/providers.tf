provider "aws" {
  region = "ap-southeast-2"
}

terraform {
  backend "s3" {
    bucket = "terraform.ruchij.com"
    key = "spa-health-check-app.tfstate"
    region = "ap-southeast-2"
  }

  required_providers {
    aws = "~> 4.20.1"
  }
}