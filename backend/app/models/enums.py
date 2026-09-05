from enum import Enum

class UserRole(str, Enum):
    SALES_REP = "sales_rep"
    SALES_MANAGER = "sales_manager"
    FINANCE_OPS = "finance_ops"
    ADMIN = "admin"
    CUSTOMER = "customer"

class CustomerTier(str, Enum):
    BRONZE = "bronze"
    SILVER = "silver"
    GOLD = "gold"

class ProductType(str, Enum):
    HARDWARE = "hardware"
    SERVICE = "service"
    SUBSCRIPTION = "subscription"

class ApprovalLevel(str, Enum):
    MANAGER = "manager"
    MANAGER_FINANCE = "manager_finance"

class QuoteStatus(str, Enum):
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    REJECTED = "rejected"
    REVISION_REQUIRED = "revision_required"
    SENT = "sent"
    UNDER_NEGOTIATION = "under_negotiation"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"


class QuoteLineType(str, Enum):
    ONE_TIME = "one_time"
    RECURRING = "recurring"

class ApprovalStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    RETURNED = "returned"

class FulfillmentPlanStatus(str, Enum):
    PROPOSED = "proposed"
    ACCEPTED = "accepted"
    PARTIALLY_FULFILLED = "partially_fulfilled"
    FULFILLED = "fulfilled"
    BACKORDERED = "backordered"
    CANCELLED = "cancelled"


class FulfillmentAllocationStatus(str, Enum):
    RESERVED = "reserved"
    PARTIALLY_FULFILLED = "partially_fulfilled"
    FULFILLED = "fulfilled"
    CANCELLED = "cancelled"


class BackorderStatus(str, Enum):
    OPEN = "open"
    ALLOCATED = "allocated"
    FULFILLED = "fulfilled"
    CANCELLED = "cancelled"

class NegotiationStatus(str, Enum):
    OPEN = "open"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn" 