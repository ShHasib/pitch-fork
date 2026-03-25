import { LucideIcon } from 'lucide-react';

export type Tab = 'home' | 'start' | 'me' | 'deposit' | 'withdraw' | 'security' | 'transactions' | 'commissions' | 'login' | 'register' | 'withdraw-history' | 'deposit-history' | 'cert' | 'contact' | 'terms' | 'profit' | 'faq' | 'about' | 'admin' | 'messages';

export interface Transaction {
  id: string;
  type: 'deposit' | 'withdraw' | 'task' | 'commission';
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  timestamp: string;
  description?: string;
  hashId?: string;
  withdrawalAddress?: string;
}

export interface NavItem {
  id: Tab;
  label: string;
  icon: LucideIcon;
}

export interface ActionButton {
  label: string;
  icon: LucideIcon;
  color: string;
}

export interface Song {
  id: number;
  title: string;
  artist: string;
  duration: string;
  cover: string;
  audioUrl: string;
}

export interface CustomMission {
  amount: number;
  profit: number;
}

export interface UserStats {
  dailyProfit: number;
  todayBonus: number;
  assetBalance: number;
  totalCommission: number;
  musicAssets: number;
  credit: number;
  level: string;
  missionCount?: number;
  username: string;
  email: string;
  phone?: string;
  withdrawalAddress?: string;
  withdrawalPassword?: string;
  role?: 'user' | 'admin' | 'sub-admin';
  referralCode?: string;
  referredBy?: string;
  referralEnabled?: boolean;
  referralLimit?: number;
  referralUsageCount?: number;
  taskApproved?: boolean;
  hasCompletedTask?: boolean;
  lastResetDate?: string;
  maxMissions?: number;
  nextMissionAmount?: number;
  nextMissionProfit?: number;
  customMissions?: CustomMission[];
  bonusClaimed?: boolean;
  createdAt?: string;
}

export interface GlobalConfig {
  referralSystemEnabled: boolean;
  referralCodeRequired: boolean;
  taskActivationLink?: string;
  customerCareLink?: string;
}

export interface MissionAsset {
  id: string;
  name: string;
  image: string;
  amount: number;
  profit: number;
}

export interface Message {
  id: string;
  title: string;
  content: string;
  timestamp: string;
  isRead: boolean;
  type: 'system' | 'support' | 'bonus';
}
