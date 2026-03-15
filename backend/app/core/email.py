import asyncio
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings


def _send_smtp(to: str, subject: str, html: str) -> None:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{settings.mail_sender_name} <{settings.mail_sender_email}>"
    msg["To"] = to
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP(settings.mail_server, settings.mail_port) as smtp:
        smtp.ehlo()
        smtp.starttls()
        smtp.login(settings.mail_username, settings.mail_password)
        smtp.sendmail(settings.mail_sender_email, to, msg.as_string())


async def send_email(to: str, subject: str, html: str) -> None:
    """Send a transactional email. No-op when MAIL_ENABLED=false or credentials are missing."""
    if not settings.mail_enabled or not settings.mail_username or not settings.mail_password:
        return
    await asyncio.to_thread(_send_smtp, to, subject, html)
