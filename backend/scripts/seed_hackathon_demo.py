"""Populate an empty DealFlow360 development database with connected demo data.

This script intentionally preserves users and Alembic metadata.  It refuses to run
when application data already exists, so it cannot silently mix demo data into an
unknown live dataset.
"""
import asyncio
import hashlib
import sys
from datetime import datetime, timedelta, date
from decimal import Decimal
from pathlib import Path

# Supports both `python scripts/seed_hackathon_demo.py` and module execution.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.db.session import engine
from app.models.approval_band import ApprovalBand
from app.models.approval_chain import ApprovalChain
from app.models.audit_log import AuditLog
from app.models.backorder import Backorder
from app.models.billing import (BillingAuditLog, BillingSchedule, Invoice, InvoiceItem,
    Order, OrderItem, Payment, Subscription, SubscriptionPlan)
from app.models.category import Category
from app.models.customer import Customer
from app.models.customer_contact import CustomerContact
from app.models.discount_rule import DiscountRule
from app.models.enums import (ApprovalLevel, ApprovalStatus, BackorderStatus, CustomerTier,
    FulfillmentAllocationStatus, FulfillmentPlanStatus, NegotiationStatus, ProductType,
    QuoteLineType, QuoteStatus)
from app.models.fulfillment_allocation import FulfillmentAllocation
from app.models.fulfillment_plan import FulfillmentPlan
from app.models.inventory_stock import InventoryStock
from app.models.negotiation_request import NegotiationRequest
from app.models.portal_session import PortalSession
from app.models.price_list import PriceList
from app.models.price_list_item import PriceListItem
from app.models.product import Product
from app.models.product_recommendation import ProductRecommendationRule
from app.models.product_variant import ProductVariant
from app.models.promotion import Promotion
from app.models.quotation import Quotation
from app.models.quote_approval import QuoteApproval
from app.models.quote_line import QuoteLine
from app.models.recommendation_event import RecommendationEvent
from app.models.replenishment_rule import ReplenishmentRule
from app.models.warehouse import Warehouse
from app.models.user import User

D = Decimal
Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def main():
    async with Session() as db:
        # Refuse to overwrite data: this seeder is for the newly emptied development DB only.
        for table in (Customer, Product, Quotation, Order):
            if await db.scalar(select(func.count()).select_from(table)):
                raise RuntimeError("Demo data already exists; refusing to modify it.")
        users = list((await db.scalars(select(User).where(User.is_active.is_(True)))).all())
        reps = [u for u in users if u.role == "sales_rep"]
        managers = [u for u in users if u.role == "sales_manager"]
        finance = [u for u in users if u.role == "finance_ops"]
        if not (reps and managers and finance):
            raise RuntimeError("Active sales rep, manager, and finance users are required.")
        now = datetime.now()

        cats = []
        for name, code, desc in [
            ("Business Laptops", "HW-LAP", "Commercial notebooks and mobile workstations"),
            ("Network Infrastructure", "HW-NET", "Managed switching, routing and wireless hardware"),
            ("Collaboration Devices", "HW-COL", "Meeting-room and workplace collaboration hardware"),
            ("Implementation Services", "SVC-IMP", "Deployment, migration and enablement services"),
            ("Managed Services", "SVC-MGD", "Proactive support and managed operations"),
            ("Cloud Subscriptions", "SUB-CLD", "Recurring cloud and security subscriptions"),
        ]:
            cats.append(Category(name=name, code=code, description=desc, is_active=True))
        db.add_all(cats); await db.flush()

        warehouses = []
        for name, code, city, state, fixed, unit in [
            ("Navi Mumbai Distribution Centre", "WH-NM", "Navi Mumbai", "Maharashtra", 850, 42),
            ("Bengaluru Technology Depot", "WH-BLR", "Bengaluru", "Karnataka", 780, 38),
            ("Delhi NCR Enterprise Hub", "WH-DEL", "Gurugram", "Haryana", 920, 45),
            ("Chennai South Fulfillment Hub", "WH-CHE", "Chennai", "Tamil Nadu", 800, 40),
            ("Kolkata East Regional Depot", "WH-KOL", "Kolkata", "West Bengal", 880, 43),
        ]:
            warehouses.append(Warehouse(name=name, code=code, address="Industrial Logistics Park", city=city, state=state,
                shipping_fixed_cost=D(str(fixed)), shipping_cost_per_unit=D(str(unit)), shipping_cost_weight=D("1.0000"), is_active=True))
        db.add_all(warehouses)

        customers = []
        names = ["Aarohan Textiles Private Limited", "BluePeak Logistics LLP", "Crescent Foods India Ltd", "Dharma Retail Solutions", "Evergreen Hospitals Network", "Futura Engineering Works", "GreenGrid Energy Systems", "Horizon Education Trust", "Indus Finserve Limited", "Jivika Pharma Labs", "Kaveri Auto Components", "Lattice Consulting Group", "Meridian Hotels India", "Nexora Digital Services", "Orchid Buildcon Private Limited", "Pinnacle Agro Exports", "Quanta Meditech", "Riverview Urban Developers", "Saffron Consumer Products", "Trident Maritime Services", "Udaan Skills Foundation", "Vertex Manufacturing India", "Westbridge Legal Partners", "Yatra Hospitality Ventures", "Zenith Industrial Gases"]
        cities = [("Mumbai","Maharashtra"),("Pune","Maharashtra"),("Ahmedabad","Gujarat"),("Bengaluru","Karnataka"),("Chennai","Tamil Nadu"),("Hyderabad","Telangana"),("Gurugram","Haryana"),("Kolkata","West Bengal")]
        for i, name in enumerate(names):
            city, state = cities[i % len(cities)]; tier = [CustomerTier.BRONZE, CustomerTier.SILVER, CustomerTier.GOLD][i % 3]
            customers.append(Customer(name=name, code="CUST-%03d" % (i+1), tier=tier, email="accounts%02d@%s.in" % (i+1, name.split()[0].lower()), phone="+91-98%08d" % (100000+i), address="%d Business Park, Sector %d" % (20+i, i%12+1), city=city, state=state, country="India", currency="INR", is_active=i != 23))
        db.add_all(customers); await db.flush()
        contacts = [CustomerContact(customer_id=c.id, name="%s Procurement" % c.name.split()[0], email="procurement%02d@demo.dealflow.in" % (i+1), phone="+91-99%08d" % (200000+i), job_title="Procurement Manager", is_primary=True, portal_enabled=i % 2 == 0) for i,c in enumerate(customers)]
        db.add_all(contacts)

        product_specs = [
            ("AsterBook Pro 14",0,ProductType.HARDWARE,78000,61000,"unit",18),("AsterBook Pro 16",0,ProductType.HARDWARE,105000,83000,"unit",18),("Orbit Office Desktop",0,ProductType.HARDWARE,62000,48000,"unit",18),("Nimbus 24-inch Monitor",2,ProductType.HARDWARE,14500,9800,"unit",18),("Nimbus 27-inch Monitor",2,ProductType.HARDWARE,21800,15500,"unit",18),("Vertex Wi-Fi 6 Access Point",1,ProductType.HARDWARE,18500,12600,"unit",18),("Vertex 24-Port PoE Switch",1,ProductType.HARDWARE,46000,33800,"unit",18),("SecureEdge Firewall 100",1,ProductType.HARDWARE,89000,65000,"unit",18),("ConferenceView 4K Camera",2,ProductType.HARDWARE,32500,22500,"unit",18),("CollabSound Speakerphone",2,ProductType.HARDWARE,12800,8200,"unit",18),
            ("Office Network Assessment",3,ProductType.SERVICE,18000,9000,"engagement",18),("Enterprise Deployment Service",3,ProductType.SERVICE,65000,36000,"engagement",18),("Data Migration Workshop",3,ProductType.SERVICE,42000,24000,"day",18),("Managed Helpdesk Onboarding",4,ProductType.SERVICE,28000,16000,"engagement",18),("Security Posture Review",4,ProductType.SERVICE,52000,31000,"engagement",18),
            ("CloudShield Endpoint Security",5,ProductType.SUBSCRIPTION,950,420,"seat/month",18),("CloudShield Email Protection",5,ProductType.SUBSCRIPTION,620,270,"seat/month",18),("Workplace Backup Standard",5,ProductType.SUBSCRIPTION,480,190,"seat/month",18),("Fleet Device Management",5,ProductType.SUBSCRIPTION,350,130,"device/month",18),("Insight Analytics Pro",5,ProductType.SUBSCRIPTION,1250,540,"seat/month",18),
            ("RackMount UPS 3kVA",1,ProductType.HARDWARE,72000,53000,"unit",18),("ErgoWork Docking Station",2,ProductType.HARDWARE,9800,6100,"unit",18),("Branch Router X200",1,ProductType.HARDWARE,39500,27500,"unit",18),("Field Installation Service",3,ProductType.SERVICE,22000,12000,"day",18),("Managed Network Monitoring",4,ProductType.SUBSCRIPTION,7600,3100,"site/month",18)]
        products=[]
        for i,(name,ci,ptype,price,cost,unit,tax) in enumerate(product_specs):
            products.append(Product(name=name, code="DF-%03d"%(i+1), category_id=cats[ci].id, product_type=ptype, description="Enterprise-grade %s for Indian B2B operations."%name, base_price=D(str(price)), cost_price=D(str(cost)), unit=unit, tax_rate=D(str(tax)), is_active=i != 24))
        db.add_all(products); await db.flush()
        variants=[]
        for i,p in enumerate(products[:10]):
            variants.append(ProductVariant(product_id=p.id, attribute="Configuration", value="Business Edition", sku="SKU-%03d-BIZ"%(i+1), extra_price=D("0")))
        db.add_all(variants)

        chains=[ApprovalChain(name="Standard Commercial Approval",description="Manager approval for controlled discount exceptions",is_active=True), ApprovalChain(name="Strategic Deal Approval",description="Manager and finance approval for high-risk discounts",is_active=True)]
        db.add_all(chains); await db.flush()
        db.add_all([ApprovalBand(approval_chain_id=chains[0].id,min_excess_percent=D("0"),max_excess_percent=D("5"),approval_level=ApprovalLevel.MANAGER), ApprovalBand(approval_chain_id=chains[1].id,min_excess_percent=D("5.01"),max_excess_percent=None,approval_level=ApprovalLevel.MANAGER_FINANCE)])
        for tier, limit in [(CustomerTier.BRONZE,5),(CustomerTier.SILVER,10),(CustomerTier.GOLD,15)]:
            for ci in range(6): db.add(DiscountRule(customer_tier=tier,category_id=cats[ci].id,max_discount_percent=D(str(max(3,limit-(5 if ci in (3,4) else 0)))),approval_chain_id=chains[1 if ci in (3,4) else 0].id,is_active=True))
        plans=[]
        for name, interval, price in [("CloudShield Monthly","MONTHLY",950),("CloudShield Annual","YEARLY",10200),("Managed Network Quarterly","QUARTERLY",22800),("Workplace Backup Monthly","MONTHLY",480),("Insight Analytics Annual","YEARLY",13500)]:
            plans.append(SubscriptionPlan(name=name,interval=interval,price=D(str(price)),currency="INR",proration_enabled=True,cancellation_policy="IMMEDIATE",refund_policy="PRORATED",active=True))
        db.add_all(plans)
        await db.flush()
        lists=[]
        for tier, mult in [(CustomerTier.BRONZE,D("1.00")),(CustomerTier.SILVER,D("0.95")),(CustomerTier.GOLD,D("0.90"))]:
            lists.append(PriceList(name=tier.value.title()+" India FY26",code="PL-"+tier.value.upper(),customer_tier=tier,currency="INR",is_active=True))
        db.add_all(lists); await db.flush()
        for plist,mult in zip(lists,[D("1.00"),D("0.95"),D("0.90")]):
            for p in products: db.add(PriceListItem(price_list_id=plist.id,product_id=p.id,variant_id=None,price=(p.base_price*mult).quantize(D("0.01"))))
        for i,p in enumerate(products):
            db.add(InventoryStock(warehouse_id=warehouses[i%5].id,product_id=p.id,variant_id=None,quantity_on_hand=D(str(15+(i%6)*10)),quantity_reserved=D(str(i%4))))
            db.add(ReplenishmentRule(warehouse_id=warehouses[i%5].id,product_id=p.id,variant_id=None,reorder_point=D("10"),reorder_quantity=D("25"),max_stock=D("100")))
        for i in range(25):
            db.add(ProductRecommendationRule(source_product_id=products[i].id,suggested_product_id=products[(i+5)%25].id,co_purchase_count=15+i,recommendation_weight=D("1.25"),minimum_margin_percent=D("15"),is_active=True))
        for i in range(8): db.add(Promotion(product_id=products[i].id,name="Q3 Enterprise Bundle %02d"%(i+1),ranking_boost=D("15"),starts_at=now-timedelta(days=10),ends_at=now+timedelta(days=45),is_active=True))
        await db.flush()

        quotes=[]; all_lines=[]
        statuses=[QuoteStatus.DRAFT,QuoteStatus.PENDING_APPROVAL,QuoteStatus.APPROVED,QuoteStatus.SENT,QuoteStatus.UNDER_NEGOTIATION,QuoteStatus.CONFIRMED,QuoteStatus.REJECTED]
        for i,c in enumerate(customers):
            created=now-timedelta(days=2+i*3); status=statuses[i%len(statuses)]; lines=[]
            for j in range(3):
                p=products[(i*3+j)%25]; qty=D(str(2+(i+j)%8)); unit=(p.base_price*(D("1.00") if c.tier==CustomerTier.BRONZE else D("0.95") if c.tier==CustomerTier.SILVER else D("0.90"))).quantize(D("0.01")); disc=D(str((i+j)%6 if status != QuoteStatus.PENDING_APPROVAL else 12+j)); sub=(qty*unit).quantize(D("0.01")); da=(sub*disc/D("100")).quantize(D("0.01")); tax=((sub-da)*p.tax_rate/D("100")).quantize(D("0.01")); total=sub-da+tax
                lines.append((p,qty,unit,disc,sub,da,tax,total))
            subtotal=sum(x[4] for x in lines); discount=sum(x[5] for x in lines); tax=sum(x[6] for x in lines); total=sum(x[7] for x in lines); cost=sum((x[1]*x[0].cost_price for x in lines),D("0")); margin=total-cost
            q=Quotation(quote_number="Q-%06d"%(100001+i),customer_id=c.id,created_by_user_id=reps[i%len(reps)].id,status=status,customer_tier_snapshot=c.tier,currency="INR",subtotal=subtotal,discount_total=discount,tax_total=tax,grand_total=total,total_cost=cost,gross_margin=margin,gross_margin_percent=(margin/total*100).quantize(D("0.01")),risk_score=D(str((i%8)*12)),notes="FY26 technology refresh proposal for "+c.name,valid_until=now+timedelta(days=30-i),created_at=created,updated_at=created,approval_level_required=(ApprovalLevel.MANAGER_FINANCE if status==QuoteStatus.PENDING_APPROVAL else None),submitted_at=created+timedelta(days=1) if status in (QuoteStatus.PENDING_APPROVAL,QuoteStatus.APPROVED,QuoteStatus.SENT,QuoteStatus.CONFIRMED) else None,approved_at=created+timedelta(days=2) if status in (QuoteStatus.APPROVED,QuoteStatus.SENT,QuoteStatus.CONFIRMED) else None,approval_version=1,last_evaluated_at=created+timedelta(days=1))
            db.add(q); await db.flush(); quotes.append(q)
            for j,x in enumerate(lines):
                p,qty,unit,disc,sub,da,taxv,totalv=x; line=QuoteLine(quotation_id=q.id,line_number=j+1,product_id=p.id,variant_id=None,line_type=QuoteLineType.RECURRING if p.product_type==ProductType.SUBSCRIPTION else QuoteLineType.ONE_TIME,description_snapshot=p.name,quantity=qty,unit_price=unit,unit_cost=p.cost_price,discount_percent=disc,discount_amount=da,tax_rate=p.tax_rate,line_subtotal=sub,line_total=totalv,line_cost=qty*p.cost_price,margin_amount=totalv-qty*p.cost_price,notes=None,created_at=created,updated_at=created); db.add(line); all_lines.append((q,line,p))
            if status in (QuoteStatus.PENDING_APPROVAL,QuoteStatus.APPROVED,QuoteStatus.SENT,QuoteStatus.CONFIRMED): db.add(QuoteApproval(quotation_id=q.id,approval_version=1,step_order=1,approval_level=ApprovalLevel.MANAGER,status=ApprovalStatus.PENDING if status==QuoteStatus.PENDING_APPROVAL else ApprovalStatus.APPROVED,acted_by_user_id=None if status==QuoteStatus.PENDING_APPROVAL else managers[0].id,acted_at=None if status==QuoteStatus.PENDING_APPROVAL else created+timedelta(days=1),reason="Discount exception review"))
            db.add(AuditLog(entity_type="quotation",entity_id=q.id,action="QUOTE_"+status.value.upper(),user_id=q.created_by_user_id,reason="Demo workflow event",metadata_json="{\"source\":\"hackathon_seed\"}",occurred_at=created))
        await db.flush()
        # Recommendations, portal history and negotiations relate only to existing quotes/contacts.
        for i in range(25):
            q=quotes[i]; src=products[(i*3)%25]; sug=products[(i*3+5)%25]
            db.add(RecommendationEvent(quotation_id=q.id,source_product_id=src.id,suggested_product_id=sug.id,user_id=q.created_by_user_id,action="accepted" if i%3==0 else "dismissed",occurred_at=q.created_at+timedelta(hours=2)))
            if i%2==0:
                db.add(PortalSession(customer_contact_id=contacts[i].id,quotation_id=q.id,token_hash=hashlib.sha256(("demo-portal-%d"%i).encode()).hexdigest(),expires_at=now+timedelta(days=3),last_used_at=now-timedelta(hours=2)))
            if q.status==QuoteStatus.UNDER_NEGOTIATION:
                line=[l for qq,l,p in all_lines if qq.id==q.id][0]
                db.add(NegotiationRequest(quotation_id=q.id,customer_contact_id=contacts[i].id,quote_line_id=line.id,message="Please consider a revised commercial discount for our phased rollout.",requested_discount_percent=D("14"),requested_quantity=None,status=NegotiationStatus.OPEN))
        await db.flush()
        # Convert confirmed/approved quotes into coherent hybrid orders, invoices and payments.
        eligible=[q for q in quotes if q.status in (QuoteStatus.CONFIRMED,QuoteStatus.APPROVED)][:10]
        for i,q in enumerate(eligible):
            order=Order(customer_id=q.customer_id,quotation_id=q.id,order_number="ORD-DEMO-%04d"%(i+1),status="CONFIRMED",currency="INR",subtotal=q.subtotal,discount_amount=q.discount_total,tax_amount=q.tax_total,total_amount=q.grand_total,confirmed_at=q.approved_at or now); db.add(order); await db.flush()
            qlines=[(l,p) for qq,l,p in all_lines if qq.id==q.id]
            one=[]
            for line,p in qlines:
                recurring=line.line_type==QuoteLineType.RECURRING
                item=OrderItem(order_id=order.id,product_id=p.id,product_name_snapshot=p.name,quantity=line.quantity,unit_price=line.unit_price,discount_percent=line.discount_percent,discount_amount=line.discount_amount,tax_amount=line.line_total-(line.line_subtotal-line.discount_amount),total_amount=line.line_total,billing_type="RECURRING" if recurring else "ONE_TIME",subscription_plan_id=plans[i%len(plans)].id if recurring else None,recurring_unit="month" if recurring else None,recurring_interval=1 if recurring else None,billing_start_date=date.today() if recurring else None); db.add(item); await db.flush()
                if recurring:
                    sub=Subscription(order_id=order.id,customer_id=q.customer_id,order_item_id=item.id,subscription_plan_id=plans[i%len(plans)].id,status="ACTIVE",quantity=item.quantity,unit_price=plans[i%len(plans)].price,current_period_start=date.today()-timedelta(days=10),current_period_end=date.today()+timedelta(days=20),next_billing_date=date.today()+timedelta(days=20)); db.add(sub); await db.flush(); db.add(BillingSchedule(subscription_id=sub.id,billing_date=date.today()+timedelta(days=20),period_start=date.today()+timedelta(days=20),period_end=date.today()+timedelta(days=50),amount=sub.quantity*sub.unit_price,status="PENDING"))
                else: one.append(item)
            if one:
                subtotal=sum((x.quantity*x.unit_price for x in one),D("0")); discount=sum((x.discount_amount for x in one),D("0")); tax=sum((x.tax_amount for x in one),D("0")); total=subtotal-discount+tax
                inv=Invoice(order_id=order.id,customer_id=q.customer_id,invoice_number="INV-DEMO-%04d"%(i+1),invoice_type="ONE_TIME",status="PAID" if i%3==0 else "PARTIALLY_PAID" if i%3==1 else "ISSUED",currency="INR",subtotal=subtotal,discount_amount=discount,tax_amount=tax,total_amount=total,amount_paid=total if i%3==0 else (total/D("2")).quantize(D("0.01")) if i%3==1 else D("0"),amount_due=D("0") if i%3==0 else (total/D("2")).quantize(D("0.01")) if i%3==1 else total,due_date=date.today()+timedelta(days=20),issued_at=now-timedelta(days=5),paid_at=now-timedelta(days=2) if i%3==0 else None); db.add(inv); await db.flush()
                for item in one: db.add(InvoiceItem(invoice_id=inv.id,order_item_id=item.id,subscription_id=None,description=item.product_name_snapshot,quantity=item.quantity,unit_price=item.unit_price,discount_amount=item.discount_amount,tax_amount=item.tax_amount,total_amount=item.total_amount))
                if inv.amount_paid: db.add(Payment(invoice_id=inv.id,order_id=order.id,customer_id=q.customer_id,payment_reference="PAY-DEMO-%04d"%(i+1),amount=inv.amount_paid,refunded_amount=D("0"),currency="INR",payment_method="BANK_TRANSFER" if i%2 else "UPI",status="SUCCESS",paid_at=inv.paid_at or now))
            db.add(BillingAuditLog(order_id=order.id,invoice_id=None,payment_id=None,subscription_id=None,action="ORDER_CREATED",old_value=None,new_value=str(order.total_amount),performed_by=finance[0].id,reason="Hackathon demo seed",created_at=now))
        await db.flush()
        # Approved/confirmed deals demonstrate split fulfillment; selected low-stock lines demonstrate backorders.
        for i,q in enumerate(eligible):
            plan=FulfillmentPlan(quotation_id=q.id,status=FulfillmentPlanStatus.PARTIALLY_FULFILLED if i%3==0 else FulfillmentPlanStatus.ACCEPTED,estimated_shipment_count=2,estimated_shipping_cost=D("1760"),accepted_at=now-timedelta(days=1)); db.add(plan); await db.flush()
            qlines=[l for qq,l,p in all_lines if qq.id==q.id][:2]
            for j,line in enumerate(qlines): db.add(FulfillmentAllocation(fulfillment_plan_id=plan.id,quote_line_id=line.id,warehouse_id=warehouses[(i+j)%5].id,requested_quantity=line.quantity,allocated_quantity=line.quantity,fulfilled_quantity=line.quantity-D("1") if i%3==0 else line.quantity,shipment_cost=D("880"),status=FulfillmentAllocationStatus.PARTIALLY_FULFILLED if i%3==0 else FulfillmentAllocationStatus.FULFILLED,manual_override=i%4==0))
            if i%3==0: db.add(Backorder(quotation_id=q.id,quote_line_id=qlines[0].id,quantity_remaining=D("1"),status=BackorderStatus.OPEN,expected_at=now+timedelta(days=7)))
        await db.commit()
        print("Seed complete: 25 customers, 25 products, 25 quotes, connected catalog/governance/inventory/billing/fulfillment data.")

if __name__ == "__main__":
    asyncio.run(main())
