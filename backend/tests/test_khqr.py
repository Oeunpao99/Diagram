import pytest

from app.services import khqr

MERCHANT = khqr.Merchant(account_id="kumnous@aclb", name="Kumnous", city="Phnom Penh")


def test_crc16_ccitt_false_check_value():
    # The standard check value for CRC-16/CCITT-FALSE.
    assert khqr.crc16("123456789") == "29B1"


@pytest.mark.parametrize(
    ("cents", "text"),
    [(300, "3"), (900, "9"), (350, "3.5"), (305, "3.05"), (1, "0.01"), (12345, "123.45")],
)
def test_amount_has_no_trailing_zeros(cents, text):
    assert khqr.format_amount(cents) == text


def test_dynamic_qr_layout():
    qr = khqr.build(
        MERCHANT,
        amount_cents=300,
        bill_number="abc123",
        store_label="Kumnous",
        terminal_label="Line 100cr",
        expires_in_seconds=900,
        now_ms=1_700_000_000_000,
    )
    expected_body = (
        "000201"
        "010212"
        "2916" + "0012kumnous@aclb"
        "52045999"
        "5303840"
        "54013"
        "5802KH"
        "5907Kumnous"
        "6010Phnom Penh"
        "6235" + "0106abc123" + "0307Kumnous" + "0710Line 100cr"
        "9934" + "00131700000000000" + "01131700000900000"
        "6304"
    )
    assert qr[:-4] == expected_body
    assert qr[-4:] == khqr.crc16(expected_body)
    # Field order matters to bank apps; parse() keeps insertion order.
    assert list(khqr.parse(qr)) == [
        "00",
        "01",
        "29",
        "52",
        "53",
        "54",
        "58",
        "59",
        "60",
        "62",
        "99",
        "63",
    ]


def test_optional_account_fields_nest_under_tag_29():
    qr = khqr.build(
        khqr.Merchant(
            account_id="kumnous@aclb",
            name="Kumnous",
            account_info="012345678",
            acquiring_bank="ACLEDA Bank",
        ),
        amount_cents=900,
        now_ms=1_700_000_000_000,
    )
    assert khqr.parse(qr)["29"] == "0012kumnous@aclb" + "0109012345678" + "0211ACLEDA Bank"
    assert "62" not in khqr.parse(qr)  # no additional data -> tag omitted


def test_md5_identifies_the_exact_qr():
    a = khqr.build(MERCHANT, amount_cents=300, now_ms=1)
    b = khqr.build(MERCHANT, amount_cents=300, now_ms=2)
    assert len(khqr.md5(a)) == 32
    assert khqr.md5(a) != khqr.md5(b)


@pytest.mark.parametrize(
    "kwargs",
    [
        {"amount_cents": 0},
        {"amount_cents": 300, "currency": "EUR"},
    ],
)
def test_rejects_bad_orders(kwargs):
    with pytest.raises(ValueError):
        khqr.build(MERCHANT, **kwargs)


def test_rejects_overlong_merchant_name():
    with pytest.raises(ValueError):
        khqr.build(khqr.Merchant(account_id="a@b", name="x" * 26), amount_cents=300)
