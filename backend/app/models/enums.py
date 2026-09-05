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