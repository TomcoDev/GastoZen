import React from 'react';
import { Category, Account } from './types';

export const APP_NAME = "GastoZen";

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-food', name: 'Alimentación', color: '#EF4444', type: 'expense', icon: '🍔' },
  { id: 'cat-groceries', name: 'Supermercado', color: '#F97316', type: 'expense', icon: '🛒' },
  { id: 'cat-transport', name: 'Transporte', color: '#F59E0B', type: 'expense', icon: '🚗' },
  { id: 'cat-utilities', name: 'Servicios', color: '#EAB308', type: 'expense', icon: '💡' },
  { id: 'cat-housing', name: 'Vivienda', color: '#84CC16', type: 'expense', icon: '🏠' },
  { id: 'cat-health', name: 'Salud', color: '#22C55E', type: 'expense', icon: '🏥' },
  { id: 'cat-entertainment', name: 'Entretenimiento', color: '#10B981', type: 'expense', icon: '🎬' },
  { id: 'cat-shopping', name: 'Compras', color: '#06B6D4', type: 'expense', icon: '🛍️' },
  { id: 'cat-personal', name: 'Cuidado Personal', color: '#0EA5E9', type: 'expense', icon: '🧴' },
  { id: 'cat-education', name: 'Educación', color: '#3B82F6', type: 'expense', icon: '📚' },
  { id: 'cat-gifts', name: 'Regalos/Donaciones', color: '#6366F1', type: 'expense', icon: '🎁' },
  { id: 'cat-travel', name: 'Viajes', color: '#8B5CF6', type: 'expense', icon: '✈️' },
  { id: 'cat-misc-expense', name: 'Gasto Diverso', color: '#A855F7', type: 'expense', icon: '📎' },
  { id: 'cat-salary', name: 'Salario', color: '#16A34A', type: 'income', icon: '💰' },
  { id: 'cat-freelance', name: 'Freelance/Bonos', color: '#059669', type: 'income', icon: '💼' },
  { id: 'cat-investments', name: 'Inversiones', color: '#047857', type: 'income', icon: '📈' },
  { id: 'cat-other-income', name: 'Otro Ingreso', color: '#065F46', type: 'income', icon: '🪙' },
];

export const DEFAULT_ACCOUNTS: Account[] = [
  { id: 'acc-checking', name: 'Cuenta Principal', type: 'checking', balance: 1000, color: '#3B82F6', icon: '🏛️' },
  { id: 'acc-savings', name: 'Cuenta de Ahorros', type: 'savings', balance: 5000, color: '#22C55E', icon: '🐷' },
  { id: 'acc-credit', name: 'Tarjeta de Crédito', type: 'credit_card', balance: 0, color: '#EF4444', icon: '💳' },
  { id: 'acc-cash', name: 'Efectivo', type: 'cash', balance: 150, color: '#F97316', icon: '💵' },
];

export const PlusIcon = ({ className }: { className?: string }) => (
  <svg className={className || "w-6 h-6"} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
  </svg>
);

export const EditIcon: React.FC<{className?: string}> = ({ className }) => (
  <svg className={className || "w-5 h-5"} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
  </svg>
);

export const TrashIcon: React.FC<{className?: string}> = ({ className }) => (
  <svg className={className || "w-5 h-5"} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
  </svg>
);

export const CheckIcon: React.FC<{className?: string}> = ({ className }) => (
  <svg className={className || "w-6 h-6"} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
  </svg>
);

export const XIcon: React.FC<{className?: string}> = ({ className }) => (
  <svg className={className || "w-6 h-6"} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
  </svg>
);

export const SparklesIcon: React.FC<{className?: string}> = ({ className }) => (
  <svg className={className || "w-5 h-5"} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6.343 6.343l2.829 2.829m11.313-2.829l-2.829 2.829M12 21v-4m-3.657-3.657l-2.829 2.829M21 12h-4m2.343-7.657l-2.829-2.829M12 2v4m3.657 3.657l2.829-2.829M3 12h4m-2.343 7.657l2.829 2.829"></path>
  </svg>
);

export const ArrowUpIcon: React.FC<{className?: string}> = ({ className }) => (
  <svg className={className || "w-5 h-5"} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18"></path></svg>
);

export const ArrowDownIcon: React.FC<{className?: string}> = ({ className }) => (
  <svg className={className || "w-5 h-5"} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path></svg>
);

export const CogIcon: React.FC<{className?: string}> = ({ className }) => (
  <svg className={className || "w-6 h-6"} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
);

export const ChartPieIcon: React.FC<{className?: string}> = ({ className }) => (
  <svg className={className || "w-6 h-6"} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 21V12A9 9 0 003.646 8.646 9 9 0 0012 21z"></path></svg>
);

export const ListBulletIcon: React.FC<{className?: string}> = ({ className }) => (
  <svg className={className || "w-6 h-6"} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"></path></svg>
);

export const CreditCardIcon: React.FC<{className?: string}> = ({ className }) => (
 <svg className={className || "w-6 h-6"} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
);

export const BuildingLibraryIcon: React.FC<{className?: string}> = ({ className }) => (
  <svg className={className || "w-6 h-6"} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.25278C12 6.25278 6.75 3 4.5 3C4.5 3 3 12 3 12M12 6.25278C12 6.25278 17.25 3 19.5 3C19.5 3 21 12 21 12M12 6.25278V21M3.75 21H20.25M3.75 12H20.25M5.25 12V21M18.75 12V21M9 21V12M15 21V12M3 21H21"></path></svg>
);

export const MenuIcon: React.FC<{className?: string}> = ({ className }) => (
  <svg className={className || "w-6 h-6"} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7"></path>
  </svg>
);