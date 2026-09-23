import { Navigate, useLocation } from 'react-router-dom';
import { getLoanProductBySlug } from '@/data/loan-products';
import { LoanProductPageView } from '@/pages/LoanProductPage';

export function LoanProductRoutePage() {
  const { pathname } = useLocation();
  const slug = pathname.replace(/^\//, '');
  const product = getLoanProductBySlug(slug);
  if (!product) return <Navigate to="/" replace />;
  return <LoanProductPageView product={product} />;
}
