from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import require_approver, require_internal_user, require_manager
from app.db.session import get_db
from app.models.enums import ApprovalLevel, ApprovalStatus, UserRole
from app.models.quote_approval import QuoteApproval
from app.models.quotation import Quotation
from app.models.user import User
from app.schemas.approval import (
    ApprovalActionRequest,
    ApprovalResponse,
    QuoteEvaluationResponse,
    SubmitQuoteResponse,
)
from app.services.deal_engine import (
    act_on_approval,
    evaluate_quote,
    get_current_pending_approval,
    submit_quote,
    persist_evaluation,
)


router = APIRouter(
    prefix="/api/approvals",
    tags=["Deal Engine & Approvals"],
)


@router.post(
    "/quotes/{quote_id}/evaluate",
    response_model=QuoteEvaluationResponse,
)
async def evaluate_quote_route(
    quote_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_internal_user),
):
    quote = await db.get(Quotation, quote_id)

    if not quote:
        raise HTTPException(
            status_code=404,
            detail="Quotation not found.",
        )

    try:
        evaluation = await evaluate_quote(
            db,
            quote,
        )

        await persist_evaluation(
            db,
            quote,
            evaluation,
        )

        await db.commit()

        return evaluation

    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc),
        ) from exc


@router.post(
    "/quotes/{quote_id}/submit",
    response_model=SubmitQuoteResponse,
)
async def submit_quote_route(
    quote_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_internal_user),
):
    quote = await db.get(Quotation, quote_id)

    if not quote:
        raise HTTPException(
            status_code=404,
            detail="Quotation not found.",
        )

    try:
        quote = await submit_quote(
            db,
            quote,
        )

        await db.commit()

        return {
            "quote_id": quote.id,
            "status": quote.status.value,
            "approval_version": quote.approval_version,
            "risk_score": quote.risk_score,
            "approval_level_required": (
                quote.approval_level_required
            ),
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc


@router.get(
    "/quotes/{quote_id}",
    response_model=list[ApprovalResponse],
)
async def list_quote_approvals(
    quote_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_internal_user),
):
    quote = await db.get(Quotation, quote_id)

    if not quote:
        raise HTTPException(
            status_code=404,
            detail="Quotation not found.",
        )

    result = await db.scalars(
        select(QuoteApproval)
        .where(
            QuoteApproval.quotation_id == quote.id,
            QuoteApproval.approval_version == quote.approval_version,
        )
        .order_by(QuoteApproval.step_order)
    )

    return list(result.all())


@router.post(
    "/quotes/{quote_id}/action",
    response_model=SubmitQuoteResponse,
)
async def act_on_quote(
    quote_id: str,
    data: ApprovalActionRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_approver),
):
    quote = await db.get(Quotation, quote_id)

    if not quote:
        raise HTTPException(
            status_code=404,
            detail="Quotation not found.",
        )

    approval = await get_current_pending_approval(
        db,
        quote,
    )

    if not approval:
        raise HTTPException(
            status_code=409,
            detail="No pending approval step exists for this quotation.",
        )

    if (
        approval.approval_level == ApprovalLevel.MANAGER_FINANCE
        and user.role not in {
            UserRole.FINANCE_OPS,
            UserRole.ADMIN,
        }
    ):
        raise HTTPException(
            status_code=403,
            detail="Finance approval is required for this step.",
        )

    if (
        approval.approval_level == ApprovalLevel.MANAGER
        and user.role not in {
            UserRole.SALES_MANAGER,
            UserRole.ADMIN,
        }
    ):
        raise HTTPException(
            status_code=403,
            detail="Sales Manager approval is required for this step.",
        )

    try:
        quote = await act_on_approval(
            db,
            quote,
            approval,
            user.id,
            data.action,
            data.reason,
        )

        await db.commit()

        return {
            "quote_id": quote.id,
            "status": quote.status.value,
            "approval_version": quote.approval_version,
            "risk_score": quote.risk_score,
            "approval_level_required": (
                quote.approval_level_required
            ),
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=409,
            detail=str(exc),
        ) from exc