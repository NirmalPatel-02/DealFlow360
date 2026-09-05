import { useEffect, useState, useCallback, useMemo } from 'react';
import { getErrorMessage } from '../../services/api/apiError';
import {
  listQuotations,
  getQuotation,
  createQuotation,
  addQuoteLine,
  updateQuoteLine,
  deleteQuoteLine,
  evaluateQuote,
  submitQuoteForApproval,
  actOnApproval,
  listQuoteApprovals,
} from './quotations.api';
import { TEMP_DASHBOARD_DATA } from '../dashboard/dashboard.data';

const EMPTY_FILTERS = Object.freeze({});

/**
 * Hook to fetch quotations with optional filtering
 */
export function useQuotations(filters = EMPTY_FILTERS, useTempData = false) {
  const filtersKey = JSON.stringify(filters);
  const stableFilters = useMemo(() => JSON.parse(filtersKey), [filtersKey]);
  const [quotations, setQuotations] = useState(() => (useTempData ? TEMP_DASHBOARD_DATA : []));
  const [loading, setLoading] = useState(!useTempData);
  const [error, setError] = useState(null);

  const fetchQuotations = useCallback(async () => {
    if (useTempData) {
      setQuotations(TEMP_DASHBOARD_DATA);
      setLoading(false);
      setError(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await listQuotations(stableFilters);
      setQuotations((data || []).map(normalizeQuotation));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [stableFilters, useTempData]);

  useEffect(() => {
    fetchQuotations();
  }, [fetchQuotations]);

  return { quotations, loading, error, refetch: fetchQuotations };
}

/**
 * Hook to fetch single quotation detail
 */
export function useQuotationDetail(quoteId) {
  const [quotation, setQuotation] = useState(null);
  const [loading, setLoading] = useState(!!quoteId);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    if (!quoteId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await getQuotation(quoteId);
      setQuotation(normalizeQuotation(data));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [quoteId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { quotation, loading, error, refetch: fetch };
}

/**
 * Hook for creating a new quotation
 */
export function useCreateQuotation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const create = useCallback(async (payload) => {
    try {
      setLoading(true);
      setError(null);
      const result = await createQuotation(payload);
      return result;
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { create, loading, error };
}

/**
 * Hook for managing quotation lines
 */
export function useQuotationLines(quoteId) {
  const [addingLine, setAddingLine] = useState(false);
  const [addLineError, setAddLineError] = useState(null);

  const addLine = useCallback(
    async (lineData) => {
      try {
        setAddingLine(true);
        setAddLineError(null);
        const result = await addQuoteLine(quoteId, lineData);
        return result;
      } catch (err) {
        const message = getErrorMessage(err);
        setAddLineError(message);
        throw err;
      } finally {
        setAddingLine(false);
      }
    },
    [quoteId]
  );

  const updateLine = useCallback(
    async (lineId, lineData) => {
      try {
        setAddingLine(true);
        setAddLineError(null);
        const result = await updateQuoteLine(quoteId, lineId, lineData);
        return result;
      } catch (err) {
        const message = getErrorMessage(err);
        setAddLineError(message);
        throw err;
      } finally {
        setAddingLine(false);
      }
    },
    [quoteId]
  );

  const deleteLine = useCallback(
    async (lineId) => {
      try {
        setAddingLine(true);
        setAddLineError(null);
        await deleteQuoteLine(quoteId, lineId);
      } catch (err) {
        const message = getErrorMessage(err);
        setAddLineError(message);
        throw err;
      } finally {
        setAddingLine(false);
      }
    },
    [quoteId]
  );

  return {
    addLine,
    updateLine,
    deleteLine,
    loading: addingLine,
    error: addLineError,
  };
}

/**
 * Hook for quote evaluation and submission
 */
export function useQuoteSubmission(quoteId) {
  const [evaluating, setEvaluating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [evaluation, setEvaluation] = useState(null);
  const [error, setError] = useState(null);

  const evaluate = useCallback(async () => {
    try {
      setEvaluating(true);
      setError(null);
      const result = await evaluateQuote(quoteId);
      setEvaluation(result);
      return result;
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      throw err;
    } finally {
      setEvaluating(false);
    }
  }, [quoteId]);

  const submit = useCallback(async () => {
    try {
      setSubmitting(true);
      setError(null);
      const result = await submitQuoteForApproval(quoteId);
      return result;
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      throw err;
    } finally {
      setSubmitting(false);
    }
  }, [quoteId]);

  return {
    evaluate,
    submit,
    evaluation,
    evaluating,
    submitting,
    error,
  };
}

/**
 * Hook for handling approval actions (manager/finance)
 */
export function useApprovalAction() {
  const [acting, setActing] = useState(false);
  const [error, setError] = useState(null);

  const approve = useCallback(async (quoteId) => {
    try {
      setActing(true);
      setError(null);
      return await actOnApproval(quoteId, 'approve');
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      throw err;
    } finally {
      setActing(false);
    }
  }, []);

  const reject = useCallback(async (quoteId, reason) => {
    try {
      setActing(true);
      setError(null);
      return await actOnApproval(quoteId, 'reject', reason);
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      throw err;
    } finally {
      setActing(false);
    }
  }, []);

  const returnForRevision = useCallback(async (quoteId, reason) => {
    try {
      setActing(true);
      setError(null);
      return await actOnApproval(quoteId, 'return', reason);
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      throw err;
    } finally {
      setActing(false);
    }
  }, []);

  return { approve, reject, returnForRevision, acting, error };
}

export function useQuoteApprovals(quoteId) {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(Boolean(quoteId));
  const [error, setError] = useState(null);

  const fetchApprovals = useCallback(async () => {
    if (!quoteId) return;
    try {
      setLoading(true);
      setError(null);
      setApprovals((await listQuoteApprovals(quoteId)) || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [quoteId]);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  return { approvals, loading, error, refetch: fetchApprovals };
}

function normalizeQuotation(quotation) {
  if (!quotation) return quotation;
  return {
    ...quotation,
    status: String(quotation.status || '').toUpperCase(),
    gross_margin: quotation.gross_margin ?? quotation.gross_margin_percent ?? 0,
    approval_chain: (quotation.approval_chain || []).map((approval) => ({
      ...approval,
      status: String(approval.status || '').toUpperCase(),
      approval_level: String(approval.approval_level || '').toUpperCase(),
    })),
  };
}

export default {
  useQuotations,
  useQuotationDetail,
  useCreateQuotation,
  useQuotationLines,
  useQuoteSubmission,
  useApprovalAction,
  useQuoteApprovals,
};
