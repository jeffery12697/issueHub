from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # Database
    database_url: str

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # JWT
    jwt_secret_key: str
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    # Google OAuth
    google_client_id: str
    google_client_secret: str
    google_redirect_uri: str

    # App
    frontend_url: str = "http://localhost:5173"

    # Email (SMTP)
    mail_server: str = "sandbox.smtp.mailtrap.io"
    mail_port: int = 2525
    mail_sender_name: str = "IssueHub"
    mail_sender_email: str = "noreply@issuehub.app"
    mail_username: str = ""
    mail_password: str = ""
    mail_enabled: bool = False  # Set MAIL_ENABLED=true to actually send emails

    # Dev
    allow_dev_login: bool = True  # Set ALLOW_DEV_LOGIN=false in production


settings = Settings()
