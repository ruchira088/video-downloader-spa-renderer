provider "aws" {
  region = "ap-southeast-2"
}

provider "aws" {
  region = "us-east-1"
  alias = "us-east-1"
}

terraform {
  backend "s3" {
    bucket = "terraform.ruchij.com"
    key = "spa-health-check-app.tfstate"
    region = "ap-southeast-2"
  }

  required_providers {
    aws = "~> 5.0"
  }
}