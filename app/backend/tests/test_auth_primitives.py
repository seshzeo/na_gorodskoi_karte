import asyncio
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.backend.services.auth import _hash, _new_token, validate_csrf


def test_token_hash_is_deterministic_and_not_plaintext():
    token = "sensitive-session-token"
    assert _hash(token) == _hash(token)
    assert _hash(token) != token
    assert len(_hash(token)) == 64


def test_new_tokens_are_unique():
    assert _new_token() != _new_token()


def test_valid_csrf_token_is_accepted():
    token = "valid-csrf-token"
    session = SimpleNamespace(csrf_token_hash=_hash(token))
    asyncio.run(validate_csrf(session, token))


@pytest.mark.parametrize("token", [None, "", "wrong-token"])
def test_missing_or_invalid_csrf_token_is_rejected(token):
    session = SimpleNamespace(csrf_token_hash=_hash("expected-token"))
    with pytest.raises(HTTPException) as error:
        asyncio.run(validate_csrf(session, token))
    assert error.value.status_code == 403
