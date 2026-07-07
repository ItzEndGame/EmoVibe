import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from config import Config


def send_reset_code_email(to_email, name, reset_code):
    """
    Send a password reset code via Gmail SMTP.
    Returns True on success, False on failure (failure is logged, not raised,
    so a flaky email send doesn't crash the request).
    """
    if not Config.SMTP_EMAIL or not Config.SMTP_APP_PASSWORD:
        print("⚠️  SMTP not configured — skipping email send. Check .env for SMTP_EMAIL / SMTP_APP_PASSWORD.")
        return False

    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = 'EmoTune — Password Reset Code'
        msg['From'] = f'EmoTune <{Config.SMTP_EMAIL}>'
        msg['To'] = to_email

        text_body = f"""Hi {name},

Your EmoTune password reset code is: {reset_code}

This code expires in 15 minutes. If you didn't request this, you can safely ignore this email.

— EmoTune
"""

        html_body = f"""
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #1ED760;">EmoTune</h2>
            <p>Hi {name},</p>
            <p>Your password reset code is:</p>
            <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px; background: #f4f4f4; padding: 16px; text-align: center; border-radius: 8px;">
                {reset_code}
            </p>
            <p style="color: #666; font-size: 14px;">This code expires in 15 minutes. If you didn't request this, you can safely ignore this email.</p>
        </div>
        """

        msg.attach(MIMEText(text_body, 'plain'))
        msg.attach(MIMEText(html_body, 'html'))

        with smtplib.SMTP('smtp.gmail.com', 587) as server:
            server.starttls()
            server.login(Config.SMTP_EMAIL, Config.SMTP_APP_PASSWORD)
            server.sendmail(Config.SMTP_EMAIL, to_email, msg.as_string())

        print(f"✅ Reset code email sent to {to_email}")
        return True

    except Exception as e:
        print(f"❌ Failed to send reset code email to {to_email}: {str(e)}")
        return False