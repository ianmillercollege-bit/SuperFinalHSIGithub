"""Password hashing for demo users (BACKEND_CONTRACT.md v1.4 section 7c: "stored hashed, any standard hash").

PBKDF2-HMAC-SHA256 with a random salt, stored as "pbkdf2_sha256$<iterations>$<salt hex>$<hash hex>".
Every demo password is the same (cirqo-demo), so the seed loader hashes it once per rebuild and gives
all demo users that hash; that keeps the rebuild fast and reveals nothing new.
"""

import hashlib
import hmac
import secrets

ITERATIONS = 120_000


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, ITERATIONS)
    return f"pbkdf2_sha256${ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, iterations, salt, digest = stored.split("$")
    except ValueError:
        return False
    if scheme != "pbkdf2_sha256":
        return False
    candidate = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), int(iterations))
    return hmac.compare_digest(candidate.hex(), digest)
