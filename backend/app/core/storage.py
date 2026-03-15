"""S3/MinIO storage helpers."""
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from app.core.config import settings

_PRESIGN_EXPIRY = 3600  # 1 hour


def _client():
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint_url,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
        config=Config(signature_version="s3v4"),
        region_name="us-east-1",
    )


def ensure_bucket() -> None:
    """Create the bucket if it doesn't exist (called at startup)."""
    s3 = _client()
    try:
        s3.head_bucket(Bucket=settings.s3_bucket)
    except ClientError:
        s3.create_bucket(Bucket=settings.s3_bucket)


def upload_file(key: str, data: bytes, content_type: str) -> None:
    _client().put_object(
        Bucket=settings.s3_bucket,
        Key=key,
        Body=data,
        ContentType=content_type,
    )


def delete_file(key: str) -> None:
    _client().delete_object(Bucket=settings.s3_bucket, Key=key)


def presigned_url(key: str) -> str:
    """Return a time-limited download URL for the given key."""
    # Build presigned URL then swap internal endpoint for public URL
    s3 = _client()
    url = s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.s3_bucket, "Key": key},
        ExpiresIn=_PRESIGN_EXPIRY,
    )
    # Replace internal MinIO host with the browser-accessible one
    return url.replace(settings.s3_endpoint_url, settings.s3_public_url)
