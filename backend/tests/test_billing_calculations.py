from decimal import Decimal

from app.services.billing import calculate_proration


def test_proration_for_mid_cycle_quantity_increase():
    assert calculate_proration(
        Decimal("1"), Decimal("10000"), Decimal("2"), Decimal("10000"), 15, 30
    ) == Decimal("5000.00")


def test_proration_is_zero_after_period_end():
    assert calculate_proration(
        Decimal("1"), Decimal("10000"), Decimal("2"), Decimal("10000"), 0, 30
    ) == Decimal("0.00")