def normalize_email(email: str) -> str:
    return email.strip().casefold()


def mask_email(email: str) -> str:
    local, domain = email.split("@", 1)

    if len(local) <= 2:
        masked_local = "*" * len(local)
    else:
        masked_local = local[0] + ("*" * (len(local) - 2)) + local[-1]

    return f"{masked_local}@{domain}"