import httpx

from app.core.config import settings


BREVO_URL = "https://api.brevo.com/v3/smtp/email"


async def send_email(
    to_email: str,
    subject: str,
    html_content: str,
    text_content: str,
) -> bool:
    if not settings.BREVO_API_KEY:
        return False

    payload = {
        "sender": {
            "name": settings.BREVO_SENDER_NAME,
            "email": settings.BREVO_SENDER_EMAIL,
        },
        "to": [
            {
                "email": to_email,
            }
        ],
        "subject": subject,
        "htmlContent": html_content,
        "textContent": text_content,
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                BREVO_URL,
                headers={
                    "accept": "application/json",
                    "api-key": settings.BREVO_API_KEY,
                    "content-type": "application/json",
                },
                json=payload,
            )

        return response.status_code == 201

    except httpx.HTTPError:
        return False


async def send_verification_otp(
    to_email: str,
    otp_code: str,
) -> bool:
    return await send_email(
        to_email=to_email,
        subject="Verify your DealFlow360 account",
        html_content=f"""
        <html>
            <body>
                <h2>Verify your DealFlow360 account</h2>
                <p>Your verification code is:</p>
                <h1>{otp_code}</h1>
                <p>This code expires in {settings.OTP_EXPIRE_MINUTES} minutes.</p>
                <p>If you did not create this account, you can safely ignore this email.</p>
            </body>
        </html>
        """,
        text_content=(
            f"Your DealFlow360 verification code is {otp_code}. "
            f"It expires in {settings.OTP_EXPIRE_MINUTES} minutes. "
            "If you did not create this account, ignore this email."
        ),
    )


async def send_password_reset_otp(
    to_email: str,
    otp_code: str,
) -> bool:
    return await send_email(
        to_email=to_email,
        subject="DealFlow360 password reset code",
        html_content=f"""
        <html>
            <body>
                <h2>Reset your DealFlow360 password</h2>
                <p>Your password reset code is:</p>
                <h1>{otp_code}</h1>
                <p>This code expires in {settings.OTP_EXPIRE_MINUTES} minutes.</p>
                <p>If you did not request a password reset, ignore this email.</p>
            </body>
        </html>
        """,
        text_content=(
            f"Your DealFlow360 password reset code is {otp_code}. "
            f"It expires in {settings.OTP_EXPIRE_MINUTES} minutes. "
            "If you did not request a password reset, ignore this email."
        ),
    )


async def send_password_changed_email(to_email: str) -> bool:
    return await send_email(
        to_email=to_email,
        subject="Your DealFlow360 password was changed",
        html_content="""
        <html>
            <body>
                <h2>Password changed</h2>
                <p>Your DealFlow360 password was successfully changed.</p>
                <p>If you did not perform this action, contact your administrator immediately.</p>
            </body>
        </html>
        """,
        text_content=(
            "Your DealFlow360 password was successfully changed. "
            "If you did not perform this action, contact your administrator immediately."
        ),
    )