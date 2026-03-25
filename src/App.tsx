/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, 
  ChevronRight, 
  Globe, 
  Play, 
  SkipBack, 
  SkipForward, 
  Volume2,
  Wallet,
  TrendingUp,
  Gift,
  Shield,
  Circle,
  ChevronLeft,
  ClipboardList,
  Check,
  Headset,
  Eye,
  EyeOff,
  ArrowRight,
  User,
  Star,
  X,
  AlertCircle,
  CheckCircle2,
  Info,
  Copy,
  Edit2,
  Save,
  Trash2,
  Search,
  Settings,
  Menu,
  LayoutDashboard,
  Tag,
  Gamepad2,
  ShoppingCart,
  Users,
  Key,
  Video,
  Image as ImageIcon,
  ArrowUpCircle,
  ArrowDownCircle,
  AlertTriangle,
  Clock,
  Filter,
  MessageSquare,
  LogOut,
  ShieldAlert,
  ShieldCheck,
  FileText,
  RefreshCw
} from 'lucide-react';
import { Tab, UserStats, MissionAsset, Transaction, Message } from './types';
import { NAV_ITEMS, HOME_ACTIONS, SONGS, PROFILE_FUNCTIONS, MISSION_ASSETS, RATING_OPTIONS } from './constants';
import { auth, db } from './firebase';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  deleteUser
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc,
  addDoc,
  collection,
  onSnapshot, 
  getDocFromServer,
  query,
  where,
  getDocs,
  limit,
  increment,
  runTransaction,
  writeBatch,
  collectionGroup,
  updateDoc
} from 'firebase/firestore';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

type AdminTab = 'dashboard' | 'settings' | 'categories' | 'services' | 'orders' | 'deposits' | 'withdrawals' | 'users' | 'unpin' | 'tutorials' | 'banners';

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // Throw to stop execution in critical flows
  throw new Error(errInfo.error);
}

const initialStats: UserStats = {
  dailyProfit: 0,
  todayBonus: 0,
  assetBalance: 0,
  totalCommission: 0,
  musicAssets: 0,
  credit: 100,
  level: 'LV1',
  username: 'Guest',
  email: '',
  role: 'user',
  referralCode: '',
  referredBy: '',
  referralEnabled: false,
  referralLimit: 0,
  referralUsageCount: 0,
  taskApproved: false,
  hasCompletedTask: false,
  lastResetDate: '',
  maxMissions: 25,
  nextMissionAmount: 0,
  nextMissionProfit: 0,
  customMissions: [],
  bonusClaimed: false
};

const generateReferralCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('login');
  const [navigationStack, setNavigationStack] = useState<Tab[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [stats, setStats] = useState<UserStats>(initialStats);

  const [missionCount, setMissionCount] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [totalUserCount, setTotalUserCount] = useState(0);
  const [pendingDepositAmount, setPendingDepositAmount] = useState<number | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [globalSuccess, setGlobalSuccess] = useState<string | null>(null);
  const [globalSettings, setGlobalSettings] = useState({ 
    depositAddress: '', 
    contactAddress: '',
    bonusThreshold: 40,
    bonusAmount: 10,
    defaultMaxMissions: 25,
    referralSystemEnabled: false
  });
  const maxMissions = stats.maxMissions || globalSettings.defaultMaxMissions || 25;

  useEffect(() => {
    if (globalError) {
      const timer = setTimeout(() => setGlobalError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [globalError]);

  useEffect(() => {
    if (globalSuccess) {
      const timer = setTimeout(() => setGlobalSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [globalSuccess]);

  // Track total user count
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'config', 'stats'), (snapshot) => {
      if (snapshot.exists()) {
        setTotalUserCount(snapshot.data().totalUsers || 0);
      }
    }, (error) => {
      // Silently fail for public stats, or log it
      console.warn("Could not fetch global stats:", error.message);
    });
    return () => unsubscribe();
  }, []);

  // Track global settings
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'config', 'settings'), (snapshot) => {
      if (snapshot.exists()) {
        setGlobalSettings(snapshot.data() as any);
      }
    }, (error) => {
      console.warn("Could not fetch global settings:", error.message);
    });
    return () => unsubscribe();
  }, [isLoggedIn]);

  // Track referral settings
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'config', 'referral'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setGlobalSettings(prev => ({
          ...prev,
          referralSystemEnabled: data.referralSystemEnabled ?? false
        }));
      }
    }, (error) => {
      console.warn("Could not fetch referral settings:", error.message);
    });
    return () => unsubscribe();
  }, [isLoggedIn]);

  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        }
      }
    }
    testConnection();
  }, []);

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsLoggedIn(true);
      } else {
        setIsLoggedIn(false);
        setStats(initialStats);
        setMissionCount(0);
        setMessages([]);
        setPendingDepositAmount(null);
        setNavigationStack([]);
        setGlobalError(null);
        setGlobalSuccess(null);
        // Only force login tab if not already on login or register
        if (activeTab !== 'login' && activeTab !== 'register') {
          setActiveTab('login');
        }
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, [activeTab]);

  // Redirect logic based on auth and role
  useEffect(() => {
    if (!isLoggedIn || !isAuthReady) return;

    const checkUser = async (retryCount = 0) => {
      const user = auth.currentUser;
      if (!user) {
        console.log("No user in redirect check, skipping");
        return;
      }

      try {
        console.log(`Checking user doc for redirect. UID: ${user.uid}, Email: ${user.email}, Attempt: ${retryCount + 1}`);
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        console.log("User doc exists:", userDoc.exists());
        
        if (userDoc.exists()) {
          const userData = userDoc.data() as UserStats;
          console.log("User role:", userData.role);
          if ((userData.role === 'admin' || userData.role === 'sub-admin') && (activeTab === 'login' || activeTab === 'register' || activeTab === 'home')) {
            console.log("Redirecting to admin dashboard");
            setActiveTab('admin');
          } else if (activeTab === 'login' || activeTab === 'register') {
            console.log("Redirecting to home dashboard");
            setActiveTab('home');
          }
        } else {
          console.log("User document does not exist yet for UID:", user.uid);
          if (activeTab === 'login') {
            console.log("User doc not found on login tab, signing out");
            await signOut(auth);
            setActiveTab('login');
          }
        }
      } catch (error: any) {
        console.error(`Redirect check failed (Attempt ${retryCount + 1}):`, error);
        
        // Retry on permission-denied as it might be a token propagation delay
        if (error.code === 'permission-denied' && retryCount < 3) {
          console.log(`Permission denied, retrying in 1s...`);
          setTimeout(() => checkUser(retryCount + 1), 1000);
          return;
        }

        handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
      }
    };

    checkUser();
  }, [isLoggedIn, isAuthReady, activeTab]);

  // Daily reset logic
  useEffect(() => {
    if (!isLoggedIn || !auth.currentUser || !stats.lastResetDate) return;
    
    const today = new Date().toISOString().split('T')[0];
    if (stats.lastResetDate !== today) {
      const path = `users/${auth.currentUser.uid}`;
      updateDoc(doc(db, path), {
        dailyProfit: 0,
        todayBonus: 0,
        missionCount: 0,
        bonusClaimed: false,
        lastResetDate: today
      }).catch(err => {
        console.error("Failed to reset daily stats:", err);
      });
    }
  }, [isLoggedIn, stats.lastResetDate]);

  // Data syncing
  useEffect(() => {
    if (!isLoggedIn || !auth.currentUser) return;

    const path = `users/${auth.currentUser.uid}`;
    const unsubscribe = onSnapshot(doc(db, path), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setStats({
          dailyProfit: data.dailyProfit || 0,
          todayBonus: data.todayBonus || 0,
          assetBalance: data.assetBalance || 0,
          totalCommission: data.totalCommission || 0,
          musicAssets: data.musicAssets || 0,
          credit: data.credit || 100,
          level: data.level || 'LV1',
          username: data.username || 'User',
          email: data.email || '',
          withdrawalAddress: data.withdrawalAddress || '',
          withdrawalPassword: data.withdrawalPassword || '',
          role: data.role || 'user',
          lastResetDate: data.lastResetDate || '',
          maxMissions: data.maxMissions || 25,
          nextMissionAmount: data.nextMissionAmount || 0,
          nextMissionProfit: data.nextMissionProfit || 0,
          customMissions: data.customMissions || [],
          bonusClaimed: data.bonusClaimed || false,
          referralCode: data.referralCode || '',
          referralEnabled: data.referralEnabled || false,
          taskApproved: data.taskApproved || false,
          hasCompletedTask: data.hasCompletedTask || false,
          referralLimit: data.referralLimit || 0,
          referralUsageCount: data.referralUsageCount || 0
        });
        setMissionCount(data.missionCount || 0);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });

    return () => unsubscribe();
  }, [isLoggedIn]);

  // Messages syncing
  useEffect(() => {
    if (!isLoggedIn || !auth.currentUser) return;

    const path = `users/${auth.currentUser.uid}/messages`;
    const q = query(collection(db, path));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(msgs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });

    return () => unsubscribe();
  }, [isLoggedIn]);

  const handleTabChange = (tab: Tab, amount?: number) => {
    // 1. If NOT logged in, only allow login or register
    if (!isLoggedIn && tab !== 'login' && tab !== 'register') {
      setActiveTab('login');
      setNavigationStack([]);
      return;
    }

    // 2. Prevent navigating to login/register if already logged in
    if (isLoggedIn && (tab === 'login' || tab === 'register')) {
      setActiveTab('home');
      setNavigationStack([]);
      return;
    }

    if (tab === 'deposit' && amount !== undefined) {
      setPendingDepositAmount(amount);
    } else if (tab !== 'deposit') {
      // Clear pending amount if navigating away from deposit (unless going to history)
      if (activeTab === 'deposit' && tab !== 'deposit-history') {
        setPendingDepositAmount(null);
      }
    }

    // Push current tab to stack if it's different from the new tab
    if (tab !== activeTab) {
      setNavigationStack(prev => [...prev, activeTab]);
    }
    
    setActiveTab(tab);
  };

  const [selectedCert, setSelectedCert] = useState<{title: string, image: string} | null>(null);

  const handleBack = () => {
    // 0. If NOT logged in, always go to login
    if (!isLoggedIn) {
      setActiveTab('login');
      setNavigationStack([]);
      return;
    }

    // 1. Profile and Start Mission ALWAYS go back to Home as requested
    if (activeTab === 'me' || activeTab === 'start') {
      setActiveTab('home');
      setNavigationStack([]);
      return;
    }

    // 2. Home activity back to finish activity (stay on home)
    if (activeTab === 'home') {
      window.history.pushState(null, '', window.location.href);
      return;
    }

    // 3. All other activities back to previous activity using the stack
    if (navigationStack.length > 0) {
      const newStack = [...navigationStack];
      const previousTab = newStack.pop();
      if (previousTab) {
        setNavigationStack(newStack);
        setActiveTab(previousTab);
      }
    } else {
      setActiveTab('home');
    }
  };

  // Handle browser back button to mimic Android behavior
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (isLoggedIn) {
        handleBack();
      }
    };

    window.addEventListener('popstate', handlePopState);
    // Push initial state to enable popstate handling
    window.history.pushState(null, '', window.location.href);

    return () => window.removeEventListener('popstate', handlePopState);
  }, [isLoggedIn, activeTab, navigationStack]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setGlobalSuccess('Logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
      setGlobalError('Failed to logout. Please try again.');
    }
  };

  const handleStartMission = async (amount: number, profit: number, source: 'custom' | 'next' | 'regular') => {
    if (!auth.currentUser) return;
    if (stats.assetBalance < amount) {
      setGlobalError("Insufficient balance to start mission");
      return;
    }
    const newCount = Math.min(missionCount + 1, maxMissions);
    const userRef = doc(db, 'users', auth.currentUser.uid);
    const transRef = collection(db, `users/${auth.currentUser.uid}/transactions`);
    const now = new Date().toISOString();

    try {
      const batch = writeBatch(db);
      
      const bonusThreshold = globalSettings.bonusThreshold || 40;
      const bonusAmount = globalSettings.bonusAmount || 10;
      const shouldApplyBonus = newCount >= bonusThreshold && !stats.bonusClaimed;

      const updateData: any = {
        assetBalance: increment(profit + (shouldApplyBonus ? bonusAmount : 0)),
        missionCount: newCount,
        dailyProfit: increment(profit + (shouldApplyBonus ? bonusAmount : 0)),
        todayBonus: increment(shouldApplyBonus ? bonusAmount : 0),
        totalCommission: increment(profit + (shouldApplyBonus ? bonusAmount : 0)),
        bonusClaimed: stats.bonusClaimed || shouldApplyBonus,
        hasCompletedTask: newCount >= maxMissions
      };

      if (source === 'custom') {
        const newMissions = [...(stats.customMissions || [])];
        if (newMissions[missionCount]) {
          newMissions[missionCount] = { amount: 0, profit: 0 };
        }
        updateData.customMissions = newMissions;
      } else if (source === 'next') {
        updateData.nextMissionAmount = 0;
        updateData.nextMissionProfit = 0;
      }

      // Update User Stats atomically
      batch.update(userRef, updateData);

      if (shouldApplyBonus) {
        const bonusTransRef = doc(transRef);
        batch.set(bonusTransRef, {
          type: 'commission',
          amount: bonusAmount,
          status: 'completed',
          timestamp: now,
          description: `Daily Bonus Reward (${bonusThreshold} Tasks)`
        });
        setGlobalSuccess(`Congratulations! You've earned a ${bonusAmount}$ Daily Bonus!`);
      }

      // Add Transactions
      const t1Ref = doc(transRef);
      batch.set(t1Ref, {
        type: 'task',
        amount: -amount,
        status: 'completed',
        timestamp: now,
        description: 'Order Payment'
      });

      const refundTime = new Date().toISOString();
      
      const t2Ref = doc(transRef);
      batch.set(t2Ref, {
        type: 'task',
        amount: amount,
        status: 'completed',
        timestamp: refundTime,
        description: 'Principal Return'
      });

      const t3Ref = doc(transRef);
      batch.set(t3Ref, {
        type: 'commission',
        amount: profit,
        status: 'completed',
        timestamp: refundTime,
        description: 'Order Rebate'
      });

      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, userRef.path);
    }
  };

  const handleWithdrawRequest = async (amount: number) => {
    if (!auth.currentUser) return;
    const userRef = doc(db, 'users', auth.currentUser.uid);
    const transRef = collection(db, `users/${auth.currentUser.uid}/transactions`);
    
    try {
      const batch = writeBatch(db);
      
      batch.update(userRef, { 
        assetBalance: increment(-amount)
      });

      const tRef = doc(transRef);
      batch.set(tRef, {
        type: 'withdraw',
        amount: amount,
        status: 'pending',
        timestamp: new Date().toISOString(),
        description: 'Withdrawal request',
        withdrawalAddress: stats.withdrawalAddress
      });

      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, userRef.path);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    if (!auth.currentUser) return;
    const path = `users/${auth.currentUser.uid}/messages/${id}`;
    try {
      await updateDoc(doc(db, path), { isRead: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleUpdateAddress = async (address: string, password?: string) => {
    if (!auth.currentUser) return;
    const userRef = doc(db, 'users', auth.currentUser.uid);
    try {
      await updateDoc(userRef, { 
        withdrawalAddress: address,
        ...(password && { withdrawalPassword: password })
      });
      setGlobalSuccess('Withdrawal details updated successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, userRef.path);
    }
  };

  const renderContent = () => {
    if (!isAuthReady) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

    switch (activeTab) {
      case 'login':
        return <LoginView onNavigate={handleTabChange} userCount={totalUserCount} />;
      case 'register':
        return <RegisterView onNavigate={handleTabChange} userCount={totalUserCount} globalSettings={globalSettings} />;
      case 'home':
        return <HomeView stats={stats} globalSettings={globalSettings} onNavigate={handleTabChange} />;
      case 'start':
        return <StartView stats={stats} missionCount={missionCount} maxMissions={maxMissions} onStartMission={handleStartMission} onNavigate={handleTabChange} globalSettings={globalSettings} setGlobalSuccess={setGlobalSuccess} />;
      case 'me':
        return <ProfileView stats={stats} onNavigate={handleTabChange} onLogout={handleLogout} setGlobalSuccess={setGlobalSuccess} />;
      case 'deposit':
        return <DepositView onBack={handleBack} onNavigate={handleTabChange} initialAmount={pendingDepositAmount} />;
      case 'deposit-history':
        return <DepositHistoryView onBack={handleBack} />;
      case 'withdraw':
        return <WithdrawView stats={stats} onBack={handleBack} onUpdateAddress={handleUpdateAddress} onWithdraw={handleWithdrawRequest} onNavigate={handleTabChange} />;
      case 'withdraw-history':
        return <WithdrawHistoryView onBack={handleBack} />;
      case 'security':
        return <SecurityView stats={stats} onBack={handleBack} onUpdateWithdrawPassword={(pass) => handleUpdateAddress(stats.withdrawalAddress || '', pass)} />;
      case 'transactions':
        return <TransactionsView onBack={handleBack} />;
      case 'commissions':
        return <CommissionsView stats={stats} onBack={handleBack} />;
      case 'cert':
        return (
          <>
            <StaticPageView 
              title="Certification" 
              onBack={handleBack}
              content={
                <div className="space-y-8">
                  <div className="text-center space-y-2 mb-8">
                    <h2 className="text-2xl font-black italic tracking-tighter">Pitchfork Official</h2>
                    <p className="text-zinc-500 text-sm">Verified and Certified Music Workbench</p>
                  </div>

                  <div className="grid gap-6">
                    {[
                      {
                        id: 1,
                        title: "Business License",
                        image: "https://i.ibb.co.com/v6rzV8vv/image.png",
                        description: "Official Pitchfork Business Operation License"
                      },
                      {
                        id: 2,
                        title: "Music Industry Certification",
                        image: "https://i.ibb.co.com/v6rzV8vv/image.png",
                        description: "Certified Music Review Platform"
                      },
                      {
                        id: 3,
                        title: "Security Compliance",
                        image: "https://i.ibb.co.com/v6rzV8vv/image.png",
                        description: "Data Protection and User Security Certificate"
                      }
                    ].map((cert) => (
                      <div 
                        key={cert.id} 
                        className="bg-zinc-900/50 border border-white/5 rounded-3xl overflow-hidden group cursor-pointer"
                        onClick={() => setSelectedCert({ title: cert.title, image: cert.image })}
                      >
                        <div className="aspect-[1/1.414] relative overflow-hidden bg-zinc-800 flex items-center justify-center p-4">
                          <img 
                            src={cert.image} 
                            alt={cert.title}
                            className="max-w-full max-h-full object-contain shadow-2xl group-hover:scale-[1.02] transition-transform duration-500"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = `https://picsum.photos/seed/fallback${cert.id}/800/1200`;
                            }}
                          />
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 text-xs font-bold uppercase tracking-widest">
                              Tap to View
                            </div>
                          </div>
                        </div>
                        <div className="p-6 border-t border-white/5">
                          <h3 className="text-xl font-bold mb-1">{cert.title}</h3>
                          <p className="text-zinc-400 text-sm">{cert.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-blue-600/10 border border-blue-500/20 rounded-3xl p-6 text-center">
                    <ShieldCheck className="mx-auto text-blue-500 mb-3" size={32} />
                    <h4 className="font-bold mb-2">Verified Platform</h4>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Pitchfork is a fully licensed and regulated music review platform. 
                      We maintain the highest standards of security and transparency for our users.
                    </p>
                  </div>
                </div>
              }
            />

            <AnimatePresence>
              {selectedCert && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[100] bg-black/95 flex flex-col p-4"
                >
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold">{selectedCert.title}</h3>
                    <button 
                      onClick={() => setSelectedCert(null)}
                      className="p-2 bg-white/10 rounded-full"
                    >
                      <X size={20} />
                    </button>
                  </div>
                  <div className="flex-1 flex items-center justify-center overflow-auto">
                    <img 
                      src={selectedCert.image} 
                      alt={selectedCert.title}
                      className="max-w-full max-h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        );
      case 'contact':
        return (
          <StaticPageView 
            title="Contact Us" 
            onBack={handleBack}
            content={
              <div className="space-y-8">
                <div className="bg-zinc-900/50 p-6 rounded-2xl border border-white/5 space-y-4">
                  <div className="w-12 h-12 bg-blue-600/20 rounded-full flex items-center justify-center">
                    <Headset className="text-blue-500" />
                  </div>
                  <h3 className="text-xl font-bold">Online Support</h3>
                  <p className="text-sm text-zinc-400">Our customer service team is available 24/7 to assist you with any questions or issues.</p>
                  <button 
                    onClick={() => {
                      if (globalSettings.contactAddress) {
                        window.open(globalSettings.contactAddress, '_blank');
                      }
                    }}
                    className="w-full py-3 bg-blue-600 rounded-xl font-bold"
                  >
                    Chat Now
                  </button>
                </div>
                <div className="bg-zinc-900/50 p-6 rounded-2xl border border-white/5 space-y-4">
                  <div className="w-12 h-12 bg-emerald-600/20 rounded-full flex items-center justify-center">
                    <Globe className="text-emerald-500" />
                  </div>
                  <h3 className="text-xl font-bold">Global Offices</h3>
                  <p className="text-sm text-zinc-400">Pitchfork<br />Support available 24/7</p>
                </div>
              </div>
            }
          />
        );
      case 'terms':
        return (
          <StaticPageView 
            title="Terms & Conditions" 
            onBack={handleBack}
            content={
              <div className="space-y-6 text-sm">
                <div className="w-full bg-zinc-900 rounded-2xl overflow-hidden border border-white/10 mb-6">
                  <img 
                    src="https://ais-pre-zfxzapkkwjx5to5q5xfz2e-421022282195.asia-east1.run.app/api/attachments/a-0" 
                    alt="Legal Notice" 
                    className="w-full h-auto"
                    referrerPolicy="no-referrer"
                  />
                </div>
                
                <section className="space-y-4">
                  <h3 className="text-white font-bold text-lg">I. TERMS AND CONDITIONS</h3>
                  <p>1.1) Reset requires a minimum balance of $100 in work account.</p>
                  <p>1.2) After completing a set of music ratings, the user may withdraw the entire amount in the account or continue to reset and request a withdrawal after completing all the sets for the day</p>
                </section>

                <section className="space-y-4">
                  <h3 className="text-white font-bold text-lg">II. Withdrawal.</h3>
                  <p>2.1) The maximum withdrawal amount is $10,000 for Junior Music Critic users, $20,000 for Mid-level Music Critic, and no maximum withdrawal amount for Senior Music Critic users and higher.</p>
                  <p>2.2) After completing all music ratings, users may apply for full withdrawal.</p>
                  <p>2.3) Withdrawal or refund is not available in the music rating process.</p>
                  <p>2.4) Users are required to submit withdrawal requests from the workbench to receive payment.</p>
                </section>

                <section className="space-y-4">
                  <h3 className="text-white font-bold text-lg">III. Funds</h3>
                  <p>3.1) All user funds will be safely kept in the user's account and can be requested to withdraw the full amount once the mission has been completed.</p>
                  <p>3.2) To avoid any loss of funds, the system will process all funds and not manually.</p>
                  <p>3.3) If there is any unexpected loss of funds, the workbench will take full responsibility.</p>
                </section>

                <section className="space-y-4">
                  <h3 className="text-white font-bold text-lg">IV. Account Security</h3>
                  <p>4.1) Each user can only have one workbench account. Users are advised to keep their work accounts safe. The company will not be responsible for any account losses due to the user's own reasons. Please do not disclose any passwords to others.</p>
                  <p>4.2) Users are not recommended to set their birthday, or mobile phone number as withdrawal password or login password.</p>
                  <p>4.3) Login password or withdrawal password may be reset by contacting online customer service.</p>
                  <p>4.4) Users and music producers Non-Disclosure Agreement.</p>
                  <p>4.5) The music ratings completed on this workbench are based on real-time data from genuine users. Therefore, users must ensure the confidentiality of the music rating and workbench.</p>
                </section>

                <section className="space-y-4">
                  <h3 className="text-white font-bold text-lg">V. Music ratings</h3>
                  <p>5.1) Junior Music Critic will be paid 2% for each single rating. Mid-level Music Critic will be paid 3% for each single rating.</p>
                  <p>5.2) Senior Music Critic will be paid 4% for each single rating. Principal Music Critic will be paid 8% for each single rating.</p>
                  <p>5.3) Each completed single rating, funds and commissions will returned to the user's account on the spot.</p>
                  <p>5.4) System will randomly assign single ratings to the user's account according to the total amount on the user's account.</p>
                  <p>5.5) Once the single/album has been assigned to the user's account, it cannot be canceled or skipped.</p>
                  <p>5.6) In order to protect the benefits of users, the amount of the single will increase according to the total account balance, and income will also increase accordingly.</p>
                </section>

                <section className="space-y-4">
                  <h3 className="text-white font-bold text-lg">VI. Album ratings</h3>
                  <p>6.1) Album ratings consist of 1 to 6 singles, and the system will randomly assign these albums. Users are likely to receive 1 or 6 albums.</p>
                  <p>6.2) To ensure every user's benefit, only one of the two sets of music ratings each day will receive an album rating.</p>
                  <p>6.3) Junior Music Critic gets 12% commissions for each single in the album rating. Mid-level Music Critic gets 14% commissions for each single in the album rating.</p>
                  <p>6.4) Senior Music Critic gets 20% commissions for each single in the album rating. Principal Music Critic gets 30% commissions for each single in the album rating.</p>
                  <p>6.5) Once the user receives an album, funds will not be immediately refunded to the account. They will only be returned to the account after completing each single in the album.</p>
                  <p>6.6) The system will randomly assign an album rating to a user's account.</p>
                  <p>6.7) Users can only make three extensions per set of music ratings to protect the interests of music producers. Violators will be required to make 30-50% prepayment (determined based on credit score) upon withdrawal to ensure the interests of the music producer. After prepayment, funds will be immediately returned to the user's work account.</p>
                </section>

                <section className="space-y-4">
                  <h3 className="text-white font-bold text-lg">VII. The prepayment</h3>
                  <p>7.1) The prepayment amount is the user's choice, and we cannot decide the user's prepayment amount. We recommend that users make a prepayment based on their capabilities.</p>
                  <p>7.2) If a user needs to prepay due to an album, we recommend that the user prepay according to the negative amount shown on the account.</p>
                  <p>7.3) Before making a prepayment, the user must request and confirm the wallet address from the online customer service.</p>
                  <p>7.4) If the user prepays to the invalid wallet address or to the address not provided by the online customer service, the workbench will not be held responsible for any loss.</p>
                </section>

                <section className="space-y-4">
                  <h3 className="text-white font-bold text-lg">VIII. Music producers</h3>
                  <p>8.1) There are different singles updated on the workbench every minute, a single that has not been rated for a long period will cause playing rate failure to be uploaded to the system. To protect the music producer's interest, users are required to complete the rating within 8 hours. Failure to do so may result in a complaint from the music producers which might affect the credit score of the user's work account. Users work account will be temporarily frozen when the credit score is too low.</p>
                  <p>8.2) The music producers will provide a wallet address for users to make prepayments.</p>
                </section>

                <section className="space-y-4">
                  <h3 className="text-white font-bold text-lg">IX. Invitation</h3>
                  <p>9.1) New users can only invite other users after 14 days of registration or after upgrading to Senior Music Critic Member by using the invitation code.</p>
                  <p>9.2) If the account does not complete all the music ratings, users will not be able to invite other users.</p>
                  <p>9.3) Once the invitation code has been used, it takes 14 days to renew the invitation code.</p>
                  <p>9.4) The referrer will be able to earn 20% of the new user's account commission as a referral fee (provided by the workbench, without deducting the new user's account commission).</p>
                </section>

                <section className="space-y-4">
                  <h3 className="text-white font-bold text-lg">X. Operation time</h3>
                  <p>10.1) Workbench operating hours 09:00AM-09:00PM GMT</p>
                  <p>10.2) Online customer service operating hours 09:00AM-09:00PM GMT</p>
                  <p>10.3) Workbench withdrawal time 09:00AM-09:00PM GMT</p>
                  <p>10.4) If users want to make a prepayment after the workbench operating hours, please contact online customer service in advance, no later than 09:00PM GMT</p>
                </section>
              </div>
            }
          />
        );
      case 'profit':
        return (
          <StaticPageView 
            title="Album Profit" 
            onBack={handleBack}
            content={
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { lv: 'LV1', profit: '0.5%', missions: 25 },
                    { lv: 'LV2', profit: '0.8%', missions: 30 },
                    { lv: 'LV3', profit: '1.2%', missions: 35 },
                    { lv: 'LV4', profit: '1.5%', missions: 40 },
                    { lv: 'LV5', profit: '2.0%', missions: 45 },
                    { lv: 'LV6', profit: '2.5%', missions: 50 },
                  ].map((tier) => (
                    <div key={tier.lv} className="bg-zinc-900/50 p-4 rounded-2xl border border-white/5 text-center space-y-1">
                      <p className="text-blue-500 font-bold">{tier.lv}</p>
                      <p className="text-2xl font-black italic">{tier.profit}</p>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-widest">{tier.missions} Missions</p>
                    </div>
                  ))}
                </div>
                <div className="bg-blue-600/10 p-6 rounded-2xl border border-blue-500/20">
                  <p className="text-xs text-blue-400 leading-relaxed">
                    Profits are calculated based on the album's market value and your membership level. Higher levels unlock premium albums with significantly higher commission rates.
                  </p>
                </div>
              </div>
            }
          />
        );
      case 'faq':
        return (
          <StaticPageView 
            title="FAQ" 
            onBack={handleBack}
            content={
              <div className="space-y-6">
                <section className="space-y-4">
                  <h3 className="text-white font-bold text-lg">1. To prepay funds</h3>
                  <p className="text-sm">Due to the huge amount of information on the workbench, users should contact customer service to confirm and double check the producers' wallet address before each prepayment.</p>
                  <p className="text-sm">After successfully prepayments, users should provide the online customer service with a screenshot of the successful transfer transaction details for the verification.</p>
                  <p className="text-sm">The screenshot of the transaction address must match the wallet address provided by the customer service in order for the prepayment to take effect immediately.</p>
                  <p className="text-sm">If users encounter any problems during the prepayment process, please contact our online customer service for assistance.</p>
                </section>

                <section className="space-y-4">
                  <h3 className="text-white font-bold text-lg">2. About The Music Rating</h3>
                  <p className="text-sm">The value of the single is adjusted according to market value. The single is randomly distributed based on the total balance in the users' work account.</p>
                  <p className="text-sm">The higher the balance in a user's account, The amount of single obtained will be higher, and therefore, the profits will also be higher</p>
                  <p className="text-sm">Please be advised to prepay according to your capabilities.</p>
                </section>

                <section className="space-y-4">
                  <h3 className="text-white font-bold text-lg">3. Withdrawal</h3>
                  <p className="text-sm">Withdrawal time is 09:00AM-09:00PM GMT</p>
                </section>

                <section className="space-y-4">
                  <h3 className="text-white font-bold text-lg">4. Workbench User Mode</h3>
                  <p className="text-sm">Users can invite new users to become platform users and will receive additional referral commissions. The referral fee is an extra 20%.</p>
                </section>

                <section className="space-y-4">
                  <h3 className="text-white font-bold text-lg">5. Operating hours</h3>
                  <p className="text-sm">Users may rate the music during the operation hours from 09:00AM-09:00PM GMT daily.</p>
                  <p className="text-sm font-bold text-blue-500">Notice: For further explanation, please click "Contact Us" on the workbench and contact our online customer service!</p>
                </section>
              </div>
            }
          />
        );
      case 'messages':
        return <MessagesView messages={messages} onBack={handleBack} onMarkAsRead={handleMarkAsRead} />;
      case 'about':
        return (
          <StaticPageView 
            title="About Us" 
            onBack={handleBack}
            content={
              <div className="space-y-6 text-sm">
                <div className="text-center space-y-2 mb-8">
                  <h1 className="text-3xl font-black italic tracking-tighter">Pitchfork</h1>
                  <p className="text-blue-500 font-bold tracking-[0.2em] text-[10px] uppercase">Welcome to Pitchfork and its services!</p>
                </div>
                
                <p>To protect the security of the workbench and the site (the "Workbench Use and Services"), you should read the following "Workbench and Services License" (the "Workbench", or the " Agreement"). You are required to fully understand the terms and conditions, the terms of the services and limitations, and the separate agreement for each term, and to accept or reject the liability. If you are 18 years old or above, becoming a user of the Workbench means that you have read and agreed to the Agreement and related terms and conditions, otherwise, you are not entitled to use and enjoy the services.</p>

                <section className="space-y-4">
                  <h3 className="text-white font-bold text-lg">(A) Protection of Users' Personal Information</h3>
                  <p>1.1) It is the basic principle of this workbench to protect users' personal information and producers' information. Pitchfork uses professional encrypted storage and transmission channels for all information to protect users' safety. If any information is disclosed without the consent of the original, the site will take legal action.</p>
                  <p>1.2) In the process of using this service, users are required to provide some necessary information, for example, to carry out account registration services, users are required to fill in their mobile phone numbers and agree to use the relevant terms and conditions. If the information provided by the user is incomplete, the user may be restricted in the use process.</p>
                  <p>1.3) Under normal circumstances, the user may modify the submitted data at any time. For security reasons (such as account retrieval services), users may not be able to change their personal information at will after registration.</p>
                  <p>1.4) Pitchfork uses various security technologies and procedures and has a comprehensive management system to protect users' personal information. Any use or unauthorized use at any time will be subject to legal action. The final registered mobile phone numbers of new Pitchfork accounts and existing Pitchfork accounts are not allowed to be changed at will.</p>
                  <p>1.5) Pitchfork will not disclose the user's information to companies and organizations other than Pitchfork without the User's consent in any circumstances.</p>
                  <p>1.6) For users under the age of 18, written information from parents or law enforcement officers is required before accessing the services on this site</p>
                </section>

                <section className="space-y-4">
                  <h3 className="text-white font-bold text-lg">(B) User Responsibilities</h3>
                  <p>2.1) Users are required to complete a set of music ratings before they can apply for a withdrawal</p>
                  <p>2.2) Users may not make withdrawal requests in the middle of the music rating process</p>
                  <p>2.3) Users may not cancel or skip a single/music rating</p>
                  <p>2.4) If the user withdraws funds exceeding their current VIP category or more than $50,000, a 50% withdrawal amount needs to be prepaid to activate the large withdrawal channel. Upon completion of the large withdrawal amount channel, this prepayment will be immediately refunded to the user</p>
                </section>

                <section className="space-y-4">
                  <h3 className="text-white font-bold text-lg">(C) Terms and Conditions</h3>
                  <p>3.1) Agreement: The user contract and terms of service shall be based on the terms and conditions stipulated on the account, and the user shall provide relevant information and documents to the workbench, and the user is an attachment to the contract terms</p>
                  <p>3.2) This workbench provides services to all users by the terms and conditions. Please contact the online customer service for feedback if you have any questions or other inquiries.</p>
                </section>
              </div>
            }
          />
        );
      case 'admin':
        return <AdminDashboard onBack={() => handleTabChange('home')} onLogout={handleLogout} setGlobalSuccess={setGlobalSuccess} setGlobalError={setGlobalError} stats={stats} />;
      default:
        return <HomeView stats={stats} globalSettings={globalSettings} onNavigate={handleTabChange} />;
    }
  };

  const isFullPage = activeTab === 'deposit' || activeTab === 'login' || activeTab === 'register' || activeTab === 'admin';

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-4xl font-black italic tracking-tighter text-white animate-pulse">Pitchfork</h1>
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-blue-500/30">
      {/* Global Notifications */}
      <AnimatePresence>
        {globalError && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-4 right-4 z-[100] bg-red-600 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <AlertCircle size={20} />
              <p className="text-sm font-bold">{globalError}</p>
            </div>
            <button onClick={() => setGlobalError(null)} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
              <X size={20} />
            </button>
          </motion.div>
        )}
        {globalSuccess && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-4 right-4 z-[100] bg-emerald-600 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <Check size={20} />
              <p className="text-sm font-bold">{globalSuccess}</p>
            </div>
            <button onClick={() => setGlobalSuccess(null)} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
              <X size={20} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      {!isFullPage && (
        <header className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-md border-b border-white/5 px-4 h-14 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tighter italic">Pitchfork</h1>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => handleTabChange('messages')}
              className="relative p-2 text-zinc-400 hover:text-white transition-colors"
            >
              <Bell size={20} />
              {messages.some(m => !m.isRead) && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-500 rounded-full border-2 border-black" />
              )}
            </button>
            <button className="flex items-center gap-1 text-sm text-zinc-400 hover:text-white transition-colors">
              <Globe size={18} />
              <span>English</span>
            </button>
            {activeTab === 'me' && (
              <div className="w-10" />
            )}
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className={`${!isFullPage ? 'pt-14 pb-24' : ''}`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: activeTab === 'deposit' ? 20 : 0, y: activeTab !== 'deposit' ? 10 : 0 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: activeTab === 'deposit' ? -20 : 0, y: activeTab !== 'deposit' ? -10 : 0 }}
            transition={{ duration: 0.2 }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      {!isFullPage && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-900/90 backdrop-blur-lg border-t border-white/5 px-6 h-20 flex items-center justify-between">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            
            if (item.id === 'start') {
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabChange(item.id)}
                  className="relative -top-6 flex flex-col items-center"
                >
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 ${isActive ? 'bg-blue-600 scale-110' : 'bg-zinc-800 hover:bg-zinc-700'}`}>
                    <Icon size={32} className={isActive ? 'text-white' : 'text-zinc-400'} />
                  </div>
                  <span className={`text-xs mt-1 font-medium ${isActive ? 'text-blue-500' : 'text-zinc-500'}`}>
                    {item.label}
                  </span>
                </button>
              );
            }

            return (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                className="flex flex-col items-center gap-1 group"
              >
                <Icon 
                  size={24} 
                  className={`transition-colors duration-200 ${isActive ? 'text-blue-500' : 'text-zinc-500 group-hover:text-zinc-300'}`} 
                />
                <span className={`text-xs font-medium transition-colors duration-200 ${isActive ? 'text-blue-500' : 'text-zinc-500 group-hover:text-zinc-300'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}

function SuccessModal({ isOpen, message, onClose }: { isOpen: boolean, message: string, onClose: () => void }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-sm bg-zinc-900 border border-white/10 rounded-[2.5rem] p-8 flex flex-col items-center text-center shadow-2xl"
          >
            <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 size={48} className="text-emerald-500" />
            </div>
            <h3 className="text-2xl font-bold mb-2">Success</h3>
            <p className="text-zinc-400 mb-8">{message}</p>
            <button 
              onClick={onClose}
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 transition-colors rounded-2xl font-bold text-lg"
            >
              Confirm
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function DepositView({ onBack, onNavigate, initialAmount }: { onBack: () => void, onNavigate: (tab: Tab) => void, initialAmount?: number | null }) {
  const [usdtAddress, setUsdtAddress] = useState("TAD8qV67FkPieQQtrF2n6YtnBYTPysvWPh");
  const [copied, setCopied] = useState(false);
  const [amount, setAmount] = useState(initialAmount ? initialAmount.toString() : '');
  const [hash, setHash] = useState('');
  const [remark, setRemark] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      const settingsDoc = await getDoc(doc(db, 'config', 'settings'));
      if (settingsDoc.exists()) {
        const data = settingsDoc.data();
        if (data.depositAddress) {
          setUsdtAddress(data.depositAddress);
        }
      }
    };
    fetchSettings();
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(usdtAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    if (!hash) {
      setError('Please enter transaction hash');
      return;
    }

    setLoading(true);
    setError('');
    try {
      if (!auth.currentUser) throw new Error('User not authenticated');
      const path = `users/${auth.currentUser.uid}/transactions`;
      await addDoc(collection(db, path), {
        type: 'deposit',
        amount: Number(amount),
        status: 'pending',
        timestamp: new Date().toISOString(),
        description: remark || 'Deposit request',
        hashId: hash,
        depositAddress: usdtAddress
      });
      setShowSuccess(true);
      setAmount('');
      setHash('');
      setRemark('');
    } catch (err: any) {
      setError(err.message || 'Failed to submit deposit');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <SuccessModal 
        isOpen={showSuccess} 
        message="Deposit submitted!" 
        onClose={() => {
          setShowSuccess(false);
          onBack();
        }} 
      />
      {/* Deposit Header */}
      <header className="h-14 flex items-center justify-between px-4 border-b border-white/5 sticky top-0 bg-black z-50">
        <button onClick={onBack} className="text-zinc-400 hover:text-white transition-colors">
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-lg font-bold">Deposit</h2>
        <button 
          onClick={() => onNavigate('deposit-history')}
          className="text-zinc-400 hover:text-white transition-colors"
        >
          <ClipboardList size={20} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* Protocol Section */}
        <div className="p-4 space-y-4">
          <h3 className="text-sm font-bold text-zinc-100">Select the protocol to use</h3>
          <div className="relative w-24 h-16">
            <button className="w-full h-full bg-zinc-900 border border-zinc-800 rounded-lg flex flex-col items-center justify-center gap-1 group">
              <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                <span className="text-[10px] font-bold">₮</span>
              </div>
              <span className="text-xs font-bold text-zinc-300">TRC-20</span>
            </button>
            <div className="absolute bottom-0 right-0 w-4 h-4 bg-red-600 rounded-tl-lg flex items-center justify-center">
              <Check size={10} className="text-white" />
            </div>
          </div>
        </div>

        <div className="h-px bg-white/5 mx-4" />

        {/* Amount Section */}
        <div className="p-4 space-y-6">
          <h3 className="text-sm font-bold text-zinc-100">Deposit amount</h3>

          {error && <p className="text-red-500 text-xs text-center">{error}</p>}

          {/* USDT Address */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-zinc-100">USDT Address</label>
            <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
              <div className="flex-1 p-3 text-xs text-zinc-400 truncate">
                {usdtAddress}
              </div>
              <button 
                onClick={handleCopy}
                className="px-6 bg-white text-black text-sm font-bold hover:bg-zinc-200 transition-colors"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          {/* USDT Input */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-zinc-100">USDT</label>
            <input 
              type="text" 
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Please enter the amount you want to deposit"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Hash Input */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-zinc-100">Transaction Hash/Txid</label>
            <input 
              type="text" 
              value={hash}
              onChange={(e) => setHash(e.target.value)}
              placeholder="Transaction Hash/Txid"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Remark Input */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-zinc-100">Remark</label>
            <input 
              type="text" 
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="Remark"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Submit Button */}
          <div className="pt-4 pb-8">
            <button 
              onClick={handleSubmit}
              disabled={loading}
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] transition-all rounded-xl font-bold text-lg shadow-lg shadow-blue-600/20 disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </div>
      </div>

      {/* Background Gradient Effect */}
      <div className="fixed bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-blue-900/10 to-transparent -z-10 pointer-events-none" />
    </div>
  );
}

function LoginView({ onNavigate, userCount }: { onNavigate: (tab: Tab) => void, userCount: number }) {
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username || !password) {
      setError('Please enter both username and password');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // Sanitize username for email conversion if it's not already an email
      const sanitized = username.trim().replace(/[^a-zA-Z0-9._-]/g, '').toLowerCase();
      const email = username.includes('@') ? username.trim() : `${sanitized}@pitchfork.com`;
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      let msg = 'Failed to sign in';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        msg = 'Invalid username or password';
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'Too many failed attempts. Please try again later.';
      } else if (err.message) {
        msg = err.message;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center relative overflow-y-auto pb-12">
      {/* Background Image */}
      <div 
        className="absolute inset-0 z-0 opacity-40 bg-cover bg-center"
        style={{ backgroundImage: 'url("https://picsum.photos/seed/forest/1080/1920")' }}
      />
      
      {/* Header */}
      <div className="w-full p-6 flex justify-end items-center relative z-10">
        <Headset size={28} className="text-white" />
      </div>

      <div className="flex flex-col items-center mt-4 relative z-10">
        <h1 className="text-6xl font-black italic tracking-tighter mb-2 text-center">Pitchfork</h1>
        <p className="text-blue-500 font-bold tracking-[0.2em] text-sm">START YOUR JOURNEY</p>
      </div>

      {/* Login Card */}
      <div className="w-[90%] max-w-md mt-12 bg-zinc-900/90 backdrop-blur-md rounded-[2.5rem] p-8 relative z-10 shadow-2xl border border-white/5">
        <div className="flex justify-between items-center mb-10">
          <h2 className="text-3xl font-bold">Sign In</h2>
          <button 
            onClick={() => onNavigate('register')}
            className="text-blue-500 font-medium"
          >
            Register
          </button>
        </div>

        {error && <p className="text-red-500 text-xs mb-4 text-center">{error}</p>}

        <div className="space-y-8">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-400 flex items-center gap-1">
              <span className="text-red-500">*</span> User Name
            </label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Type Username"
              className="w-full bg-black border border-zinc-800 rounded-2xl p-4 text-white placeholder:text-zinc-700 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-400 flex items-center gap-1">
              <span className="text-red-500">*</span> Login Password
            </label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Type Password"
                className="w-full bg-black border border-zinc-800 rounded-2xl p-4 text-white placeholder:text-zinc-700 focus:outline-none focus:border-blue-500 transition-colors pr-12"
              />
              <button 
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-center mt-12">
          <button 
            onClick={handleLogin}
            disabled={loading}
            className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center shadow-[0_0_30px_rgba(37,99,235,0.4)] hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" /> : <ArrowRight size={32} className="text-white" />}
          </button>
        </div>
      </div>

      <div className="mt-auto mb-12 text-center relative z-10 space-y-6">
        <div className="flex flex-col items-center gap-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4 mx-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-blue-500" size={20} />
            <span className="text-xs font-bold uppercase tracking-widest text-zinc-300">Verified Platform</span>
          </div>
          <p className="text-[10px] text-zinc-500 leading-tight max-w-[200px]">
            Pitchfork is a fully licensed and regulated music review platform. 
            Official Certificate ID: PF-2026-8821
          </p>
          <button 
            onClick={() => onNavigate('cert')}
            className="text-[10px] text-blue-500 font-bold underline underline-offset-2"
          >
            View Official Certificate
          </button>
        </div>
        <div>
          <p className="text-zinc-300 font-medium">You have to be seen to be heard.</p>
          <p className="text-zinc-300 font-medium">What are you waiting for?</p>
        </div>
      </div>
    </div>
  );
}

function RegisterView({ onNavigate, userCount, globalSettings }: { onNavigate: (tab: Tab) => void, userCount: number, globalSettings: any }) {
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!username || !password || !phone) {
      setError('Please fill in all required fields');
      return;
    }

    // Check referral code if required
    if (globalSettings.referralSystemEnabled && !referralCode) {
      setError('Referral code is required');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (!agreed) {
      setError('Please agree to the terms of use');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // 0. Ensure we are signed out before starting registration
      if (auth.currentUser) {
        await signOut(auth);
      }

      let referredBy = '';
      if (globalSettings.referralSystemEnabled && referralCode) {
        // Master code for the first user
        if (userCount === 0 && referralCode.trim().toUpperCase() === 'ADMIN') {
          referredBy = 'system';
        } else {
          // Validate referral code against existing users
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where('referralCode', '==', referralCode.trim().toUpperCase()));
          const querySnapshot = await getDocs(q);
          if (querySnapshot.empty) {
            setError('Invalid referral code');
            setLoading(false);
            return;
          }
          
          const referrerDoc = querySnapshot.docs[0];
          const referrerData = referrerDoc.data() as UserStats;
          
          if (!referrerData.referralEnabled) {
            setError('This referral code is currently disabled');
            setLoading(false);
            return;
          }
          
          if (referrerData.referralLimit !== undefined && referrerData.referralUsageCount !== undefined) {
            if (referrerData.referralUsageCount >= referrerData.referralLimit) {
              setError('This referral code has reached its maximum usage limit');
              setLoading(false);
              return;
            }
          }

          referredBy = referrerDoc.id;
          
          // Increment referral usage count for referrer
          try {
            await updateDoc(doc(db, 'users', referrerDoc.id), {
              referralUsageCount: increment(1)
            });
          } catch (err) {
            console.error("Failed to increment referral count:", err);
          }
        }
      }

      // 1. Create or Sign In user to get authentication
      const sanitized = username.trim().replace(/[^a-zA-Z0-9._-]/g, '').toLowerCase();
      if (!sanitized && !username.includes('@')) {
        throw new Error('Username must contain at least one alphanumeric character');
      }
      const email = username.includes('@') ? username.trim() : `${sanitized}@pitchfork.com`;
      
      let user;
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        user = userCredential.user;
      } catch (authErr: any) {
        if (authErr.code === 'auth/email-already-in-use') {
          throw new Error('Username or email already taken');
        } else {
          throw authErr;
        }
      }

      // 2. Create user document
      const newUserDoc: UserStats = {
        username: username.trim(),
        email,
        phone: phone.trim(),
        dailyProfit: 0,
        todayBonus: 0,
        assetBalance: 0,
        totalCommission: 0,
        musicAssets: 0,
        credit: 100,
        level: 'LV1',
        missionCount: 0,
        role: 'user',
        referralCode: '',
        referralEnabled: false,
        referralLimit: 0,
        referralUsageCount: 0,
        taskApproved: false,
        hasCompletedTask: false,
        referredBy,
        lastResetDate: new Date().toISOString().split('T')[0],
        maxMissions: 25,
        nextMissionAmount: 0,
        nextMissionProfit: 0,
        bonusClaimed: false,
        customMissions: Array.from({ length: 25 }, () => ({ amount: 0, profit: 0 })),
        createdAt: new Date().toISOString(),
      };

      try {
        await setDoc(doc(db, `users/${user.uid}`), newUserDoc);
        // Increment total user count
        await setDoc(doc(db, 'config', 'stats'), {
          totalUsers: increment(1)
        }, { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
      }

      console.log("Registration successful.");

      // 4. Add a welcome message (simulated SMS)
      const msgPath = `users/${user.uid}/messages`;
      try {
        await addDoc(collection(db, msgPath), {
          title: 'Welcome to Pitchfork',
          content: 'Welcome! Your account has been successfully registered. Start your music review journey today and earn commissions.',
          timestamp: new Date().toISOString(),
          isRead: false,
          type: 'system'
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, msgPath);
      }

      // 5. Increment global user count
      try {
        await setDoc(doc(db, 'config', 'stats'), {
          totalUsers: increment(1)
        }, { merge: true });
      } catch (e) {
        console.warn("Failed to increment global user count:", e);
      }

      // 5. Success! Navigate to home
      onNavigate('home');
    } catch (err: any) {
      console.error("Registration error details:", err);
      setError(err.message || 'Failed to register');
      if (auth.currentUser) {
        try {
          // If Firestore failed, delete the Auth user to allow retry
          await deleteUser(auth.currentUser);
        } catch (deleteErr) {
          console.error("Failed to delete user after Firestore error:", deleteErr);
          await signOut(auth);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center relative overflow-y-auto pb-12">
      {/* Background Effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-black to-zinc-900/20 z-0" />
      
      {/* Header */}
      <div className="w-full p-6 flex justify-end items-center relative z-10">
        <Headset size={28} className="text-white" />
      </div>

      <div className="flex flex-col items-center mt-4 relative z-10">
        <h1 className="text-6xl font-black italic tracking-tighter mb-2 text-center">Pitchfork</h1>
        <p className="text-blue-500 font-bold tracking-[0.2em] text-sm">START YOUR JOURNEY</p>
      </div>

      {/* Register Card */}
      <div className="w-[90%] max-w-md mt-8 bg-zinc-900/90 backdrop-blur-md rounded-[2.5rem] p-8 relative z-10 shadow-2xl border border-white/5">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold">Register</h2>
          <button 
            onClick={() => onNavigate('login')}
            className="text-blue-500 font-medium"
          >
            Back To Login
          </button>
        </div>

        <div className="space-y-6">
          {error && <p className="text-red-500 text-xs text-center">{error}</p>}
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-400 flex items-center gap-1">
              <span className="text-red-500">*</span> User Name
            </label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Type User Name"
              className="w-full bg-black border border-zinc-800 rounded-2xl p-4 text-white placeholder:text-zinc-700 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-400 flex items-center gap-1">
              <span className="text-red-500">*</span> Login Password
            </label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Type Login Password"
                className="w-full bg-black border border-zinc-800 rounded-2xl p-4 text-white placeholder:text-zinc-700 focus:outline-none focus:border-blue-500 transition-colors pr-12"
              />
              <button 
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-400 flex items-center gap-1">
              <span className="text-red-500">*</span> Phone Number
            </label>
            <input 
              type="text" 
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Type Phone Number"
              className="w-full bg-black border border-zinc-800 rounded-2xl p-4 text-white placeholder:text-zinc-700 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {globalSettings.referralSystemEnabled && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-400 flex items-center gap-1">
                <span className="text-red-500">*</span> Referral Code
              </label>
              <input 
                type="text" 
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value)}
                placeholder="Type Referral Code"
                className="w-full bg-black border border-zinc-800 rounded-2xl p-4 text-white placeholder:text-zinc-700 focus:outline-none focus:border-blue-500 transition-colors uppercase"
              />
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button 
              onClick={() => setAgreed(!agreed)}
              className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${agreed ? 'bg-blue-600' : 'bg-zinc-800 border border-zinc-700'}`}
            >
              {agreed && <Check size={14} className="text-white" />}
            </button>
            <p className="text-sm text-zinc-400">
              I agree to the <span className="text-blue-500">"Terms of Use"</span>
            </p>
          </div>
        </div>

        <div className="flex justify-center mt-8">
          <button 
            onClick={handleRegister}
            disabled={loading}
            className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center shadow-[0_0_30px_rgba(37,99,235,0.4)] hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" /> : <ArrowRight size={32} className="text-white" />}
          </button>
        </div>
      </div>

      <div className="mt-auto mb-8 text-center relative z-10 space-y-6">
        <div className="flex flex-col items-center gap-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4 mx-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-blue-500" size={20} />
            <span className="text-xs font-bold uppercase tracking-widest text-zinc-300">Verified Platform</span>
          </div>
          <p className="text-[10px] text-zinc-500 leading-tight max-w-[200px]">
            Pitchfork is a fully licensed and regulated music review platform. 
            Official Certificate ID: PF-2026-8821
          </p>
          <button 
            onClick={() => onNavigate('cert')}
            className="text-[10px] text-blue-500 font-bold underline underline-offset-2"
          >
            View Official Certificate
          </button>
        </div>
        <div>
          <p className="text-zinc-300 font-medium">You have to be seen to be heard.</p>
          <p className="text-zinc-300 font-medium">What are you waiting for?</p>
        </div>
      </div>
    </div>
  );
}

function WithdrawView({ stats, onBack, onUpdateAddress, onWithdraw, onNavigate }: { stats: UserStats, onBack: () => void, onUpdateAddress: (address: string, password?: string) => Promise<void>, onWithdraw: (amount: number) => Promise<void>, onNavigate: (tab: Tab) => void }) {
  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSaveAddress = async () => {
    setError('');
    if (!address.trim()) {
      setError('Please enter a valid USDT address');
      return;
    }
    if (!password) {
      setError('Please set a withdrawal password');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await onUpdateAddress(address.trim(), password);
      // Success is handled by onUpdateAddress calling setGlobalSuccess
      // and the stats update will switch the view
    } catch (err: any) {
      setError(err.message || 'Failed to save address');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    setError('');
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    if (Number(amount) > stats.assetBalance) {
      setError('Insufficient balance');
      return;
    }
    if (!password) {
      setError('Please enter your password');
      return;
    }
    if (password !== stats.withdrawalPassword) {
      setError('Incorrect withdrawal password');
      return;
    }
    setLoading(true);
    try {
      await onWithdraw(Number(amount));
      setShowSuccess(true);
      setAmount('');
      setPassword('');
    } catch (err: any) {
      setError(err.message || 'Withdrawal failed');
    } finally {
      setLoading(false);
    }
  };

  if (!stats.withdrawalAddress) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col">
        <div className="p-4 flex items-center justify-between border-b border-white/5">
          <button onClick={onBack} className="p-2 -ml-2">
            <ChevronLeft size={24} />
          </button>
          <h2 className="text-lg font-bold">Save Address</h2>
          <div className="w-10" />
        </div>

        <div className="p-6 space-y-6 overflow-y-auto">
          <div className="bg-zinc-900/50 p-6 rounded-3xl border border-white/5 space-y-4">
            <p className="text-sm text-zinc-400">Please save your USDT (TRC-20) address and set a withdrawal password. Once saved, they cannot be edited.</p>
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">USDT Address</label>
              <input 
                type="text" 
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Enter TRC-20 Address"
                className="w-full bg-black border border-zinc-800 rounded-2xl p-4 text-white placeholder:text-zinc-700 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Withdrawal Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Set Withdrawal Password"
                className="w-full bg-black border border-zinc-800 rounded-2xl p-4 text-white placeholder:text-zinc-700 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Confirm Password</label>
              <input 
                type="password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm Withdrawal Password"
                className="w-full bg-black border border-zinc-800 rounded-2xl p-4 text-white placeholder:text-zinc-700 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          {error && <p className="text-red-500 text-xs text-center">{error}</p>}

          <button 
            onClick={handleSaveAddress}
            disabled={loading}
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] transition-all rounded-2xl font-bold text-lg shadow-lg shadow-blue-600/20 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Address'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <SuccessModal 
        isOpen={showSuccess} 
        message="Withdrawal successful!" 
        onClose={() => {
          setShowSuccess(false);
          onBack();
        }} 
      />
      <div className="p-4 flex items-center justify-between border-b border-white/5">
        <button onClick={onBack} className="p-2 -ml-2">
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-lg font-bold">Withdraw</h2>
        <button className="p-2 -mr-2">
          <Headset size={24} className="text-zinc-400" />
        </button>
      </div>

      <div className="p-6 space-y-6 overflow-y-auto">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
              <span className="text-red-500">*</span> Chain name
            </label>
            <div className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-zinc-300">
              TRC-20
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
              <span className="text-red-500">*</span> USDT Address
            </label>
            <div className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-zinc-300 truncate">
              {stats.withdrawalAddress}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                <span className="text-red-500">*</span> Amount
              </label>
              <span className="text-[10px] text-zinc-500">Wallet Balance: {stats.assetBalance.toFixed(2)}$</span>
            </div>
            <div className="relative">
              <input 
                type="number" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Type Amount"
                className="w-full bg-black border border-zinc-800 rounded-xl p-4 text-white placeholder:text-zinc-700 focus:outline-none focus:border-blue-500 transition-colors pr-16"
              />
              <button 
                onClick={() => setAmount(stats.assetBalance.toString())}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-500 font-bold text-sm"
              >
                All
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
              <span className="text-red-500">*</span> Password
            </label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Type Password"
              className="w-full bg-black border border-zinc-800 rounded-xl p-4 text-white placeholder:text-zinc-700 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        </div>

        <p className="text-[10px] text-zinc-500">
          <span className="text-red-500">*</span> You will receive your withdrawal within an hour
        </p>

        {error && <p className="text-red-500 text-xs text-center">{error}</p>}

        <button 
          onClick={handleWithdraw}
          disabled={loading}
          className="w-full py-4 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] transition-all rounded-2xl font-bold text-lg shadow-lg shadow-blue-600/20 disabled:opacity-50"
        >
          {loading ? 'Processing...' : 'Withdraw'}
        </button>

        <button 
          onClick={() => onNavigate('withdraw-history')}
          className="w-full text-center text-blue-500 text-sm font-medium"
        >
          Withdraw History
        </button>
      </div>
    </div>
  );
}

function TransactionsView({ onBack }: { onBack: () => void }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;
    const path = `users/${auth.currentUser.uid}/transactions`;
    const unsubscribe = onSnapshot(collection(db, path), (snapshot) => {
      const transData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Transaction[];
      setTransactions(transData.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="p-4 flex items-center justify-between border-b border-white/5">
        <button onClick={onBack} className="p-2 -ml-2">
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-lg font-bold">Transactions</h2>
        <div className="w-10" />
      </div>

      <div className="p-4 space-y-4 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12 text-zinc-500">No transactions found</div>
        ) : (
          transactions.map((trans) => (
            <div key={trans.id} className="bg-zinc-900/50 p-4 rounded-2xl border border-white/5 flex justify-between items-center">
              <div className="space-y-1">
                <p className="font-bold capitalize">{trans.description || trans.type}</p>
                <p className="text-[10px] text-zinc-500">{new Date(trans.timestamp).toLocaleString()}</p>
              </div>
              <div className="text-right space-y-1">
                <p className={`font-bold ${trans.type === 'withdraw' || trans.description === 'Order Payment' ? 'text-red-500' : 'text-emerald-500'}`}>
                  {trans.type === 'withdraw' || trans.description === 'Order Payment' ? '-$' : '+$'}{Math.abs(trans.amount).toFixed(3)}
                </p>
                <p className={`text-[10px] uppercase font-bold ${trans.status === 'completed' ? 'text-emerald-500' : 'text-amber-500'}`}>
                  {trans.status}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function WithdrawHistoryView({ onBack }: { onBack: () => void }) {
  const [withdrawals, setWithdrawals] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;
    const path = `users/${auth.currentUser.uid}/transactions`;
    const unsubscribe = onSnapshot(collection(db, path), (snapshot) => {
      const transData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() })) as Transaction[];
      const withdrawData = transData.filter(t => t.type === 'withdraw');
      setWithdrawals(withdrawData.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="p-4 flex items-center justify-between border-b border-white/5">
        <button onClick={onBack} className="p-2 -ml-2">
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-lg font-bold">Withdraw History</h2>
        <div className="w-10" />
      </div>

      <div className="p-4 space-y-4 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : withdrawals.length === 0 ? (
          <div className="text-center py-12 text-zinc-500">No withdrawal history found</div>
        ) : (
          withdrawals.map((withdraw) => (
            <div key={withdraw.id} className="bg-zinc-900/50 p-4 rounded-2xl border border-white/5 flex justify-between items-center">
              <div className="space-y-1">
                <p className="font-bold">Withdrawal</p>
                <p className="text-[10px] text-zinc-500">{new Date(withdraw.timestamp).toLocaleString()}</p>
                {withdraw.description && <p className="text-xs text-zinc-400">{withdraw.description}</p>}
              </div>
              <div className="text-right space-y-1">
                <p className="font-bold text-red-500">-${withdraw.amount.toFixed(3)}</p>
                <p className={`text-[10px] uppercase font-bold ${withdraw.status === 'completed' ? 'text-emerald-500' : 'text-amber-500'}`}>
                  {withdraw.status}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function DepositHistoryView({ onBack }: { onBack: () => void }) {
  const [deposits, setDeposits] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;
    const path = `users/${auth.currentUser.uid}/transactions`;
    const unsubscribe = onSnapshot(collection(db, path), (snapshot) => {
      const transData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() })) as Transaction[];
      const depositData = transData.filter(t => t.type === 'deposit');
      setDeposits(depositData.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="p-4 flex items-center justify-between border-b border-white/5">
        <button onClick={onBack} className="p-2 -ml-2">
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-lg font-bold">Deposit History</h2>
        <div className="w-10" />
      </div>

      <div className="p-4 space-y-4 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : deposits.length === 0 ? (
          <div className="text-center py-12 text-zinc-500">No deposit history found</div>
        ) : (
          deposits.map((deposit) => (
            <div key={deposit.id} className="bg-zinc-900/50 p-4 rounded-2xl border border-white/5 flex justify-between items-center">
              <div className="space-y-1">
                <p className="font-bold">Deposit</p>
                <p className="text-[10px] text-zinc-500">{new Date(deposit.timestamp).toLocaleString()}</p>
                {deposit.description && <p className="text-xs text-zinc-400">{deposit.description}</p>}
              </div>
              <div className="text-right space-y-1">
                <p className="font-bold text-emerald-500">+${deposit.amount.toFixed(3)}</p>
                <p className={`text-[10px] uppercase font-bold ${deposit.status === 'completed' ? 'text-emerald-500' : 'text-amber-500'}`}>
                  {deposit.status}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function CommissionsView({ stats, onBack }: { stats: UserStats, onBack: () => void }) {
  const [commissions, setCommissions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;
    const path = `users/${auth.currentUser.uid}/transactions`;
    const unsubscribe = onSnapshot(collection(db, path), (snapshot) => {
      const transData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() })) as Transaction[];
      const commData = transData.filter(t => t.type === 'commission');
      setCommissions(commData.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="p-4 flex items-center justify-between border-b border-white/5">
        <button onClick={onBack} className="p-2 -ml-2">
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-lg font-bold">Commissions</h2>
        <div className="w-10" />
      </div>

      <div className="p-4 space-y-6 overflow-y-auto">
        {/* Commission Breakdown Card */}
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-[2rem] p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl" />
          
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md">
              <TrendingUp size={24} className="text-white" />
            </div>
            <h3 className="text-xl font-bold">Commission Breakdown</h3>
          </div>

          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-1">
              <p className="text-3xl font-bold tracking-tight">{stats.dailyProfit.toFixed(2)} $</p>
              <p className="text-sm text-blue-100/80">Today Commission</p>
            </div>
            <div className="space-y-1">
              <p className="text-3xl font-bold tracking-tight">{stats.totalCommission.toFixed(2)} $</p>
              <p className="text-sm text-blue-100/80">Cumulative commissions</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-sm font-bold text-zinc-500 uppercase tracking-widest px-2">Recent Rewards</h4>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : commissions.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">No commissions found</div>
          ) : (
            commissions.map((comm) => (
              <div key={comm.id} className="bg-zinc-900/50 p-4 rounded-2xl border border-white/5 flex justify-between items-center">
                <div className="space-y-1">
                  <p className="font-bold">Commission Reward</p>
                  <p className="text-[10px] text-zinc-500">{new Date(comm.timestamp).toLocaleString()}</p>
                  {comm.description && <p className="text-xs text-zinc-400">{comm.description}</p>}
                </div>
                <div className="text-right">
                  <p className="font-bold text-emerald-500">+${comm.amount.toFixed(3)}</p>
                  <p className="text-[10px] uppercase font-bold text-emerald-500">Completed</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function SecurityView({ stats, onBack, onUpdateWithdrawPassword }: { stats: UserStats, onBack: () => void, onUpdateWithdrawPassword: (pass: string) => Promise<void> }) {
  const [activeSubTab, setActiveSubTab] = useState<'login' | 'withdraw'>('login');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleConfirm = async () => {
    setError('');
    setSuccess('');
    
    if (activeSubTab === 'withdraw' && !stats.withdrawalPassword) {
      // Setting for the first time
      if (!newPassword || newPassword.length < 6) {
        setError('New password must be at least 6 characters');
        return;
      }
    } else {
      if (!oldPassword) {
        setError('Please enter old password');
        return;
      }
      if (!newPassword || newPassword.length < 6) {
        setError('New password must be at least 6 characters');
        return;
      }
    }

    if (newPassword !== confirmNewPassword) {
      setError('New passwords do not match');
      return;
    }

    setLoading(true);
    try {
      if (activeSubTab === 'login') {
        const user = auth.currentUser;
        if (!user || !user.email) throw new Error('User not found');
        
        const credential = EmailAuthProvider.credential(user.email, oldPassword);
        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, newPassword);
        setSuccess('Login password updated successfully');
      } else {
        if (stats.withdrawalPassword) {
          if (oldPassword !== stats.withdrawalPassword) {
            throw new Error('Incorrect old withdrawal password');
          }
        }
        await onUpdateWithdrawPassword(newPassword);
        setSuccess('Withdrawal password updated successfully');
      }
      
      setOldPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err: any) {
      setError(err.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  const isSettingWithdrawFirstTime = activeSubTab === 'withdraw' && !stats.withdrawalPassword;

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="p-4 flex items-center justify-between border-b border-white/5">
        <button onClick={onBack} className="p-2 -ml-2">
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-lg font-bold">Security</h2>
        <div className="w-10" />
      </div>

      <div className="p-6 space-y-8 overflow-y-auto">
        {/* Sub Tabs */}
        <div className="flex gap-4">
          <button 
            onClick={() => { setActiveSubTab('login'); setError(''); setSuccess(''); }}
            className={`flex-1 py-3 rounded-xl font-bold transition-all ${activeSubTab === 'login' ? 'bg-blue-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Login Password
          </button>
          <button 
            onClick={() => { setActiveSubTab('withdraw'); setError(''); setSuccess(''); }}
            className={`flex-1 py-3 rounded-xl font-bold transition-all ${activeSubTab === 'withdraw' ? 'bg-blue-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Withdraw Password
          </button>
        </div>

        <div className="space-y-6">
          {error && <p className="text-red-500 text-xs text-center">{error}</p>}
          {success && <p className="text-emerald-500 text-xs text-center">{success}</p>}

          {!isSettingWithdrawFirstTime && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-400 flex items-center gap-1">
                <span className="text-red-500">*</span> Old Password
              </label>
              <div className="relative">
                <input 
                  type={showOld ? "text" : "password"} 
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="Type Old Password"
                  className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 text-white placeholder:text-zinc-700 focus:outline-none focus:border-blue-500 transition-colors pr-12"
                />
                <button 
                  onClick={() => setShowOld(!showOld)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600"
                >
                  {showOld ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-400 flex items-center gap-1">
              <span className="text-red-500">*</span> New Password
            </label>
            <div className="relative">
              <input 
                type={showNew ? "text" : "password"} 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Type New Password"
                className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 text-white placeholder:text-zinc-700 focus:outline-none focus:border-blue-500 transition-colors pr-12"
              />
              <button 
                onClick={() => setShowNew(!showNew)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600"
              >
                {showNew ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-400 flex items-center gap-1">
              <span className="text-red-500">*</span> Confirm New Password
            </label>
            <div className="relative">
              <input 
                type={showConfirm ? "text" : "password"} 
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="Type Confirm New Password"
                className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 text-white placeholder:text-zinc-700 focus:outline-none focus:border-blue-500 transition-colors pr-12"
              />
              <button 
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600"
              >
                {showConfirm ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>
        </div>

        <button 
          onClick={handleConfirm}
          disabled={loading}
          className="w-full py-4 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] transition-all rounded-2xl font-bold text-lg shadow-lg shadow-blue-600/20 disabled:opacity-50"
        >
          {loading ? 'Processing...' : 'Confirm'}
        </button>
      </div>
    </div>
  );
}

function StaticPageView({ title, content, onBack }: { title: string, content: React.ReactNode, onBack: () => void }) {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="p-4 flex items-center justify-between border-b border-white/5 sticky top-0 bg-black z-50">
        <button onClick={onBack} className="p-2 -ml-2">
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-lg font-bold">{title}</h2>
        <div className="w-10" />
      </div>
      <div className="p-6 overflow-y-auto flex-1 leading-relaxed text-zinc-300">
        {content}
      </div>
    </div>
  );
}

function WithdrawalTicker() {
  const [announcement, setAnnouncement] = useState('');
  
  const generateAnnouncement = () => {
    const prefixes = ['Xa', 'Me', 'Ki', 'Lo', 'Ru', 'Ta', 'Ve', 'Ni', 'Mo', 'Su'];
    const suffixes = ['fk', 'rt', 'lp', 'qw', 'zx', 'mn', 'bv', 'cx', 'ds', 'sa'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    const amount = (Math.random() * 1000 + 100).toFixed(3);
    return `${prefix}*****${suffix} successfully withdrew ${amount} USD`;
  };

  useEffect(() => {
    setAnnouncement(generateAnnouncement());
    const interval = setInterval(() => {
      setAnnouncement(generateAnnouncement());
    }, 15000); // Change every 15 seconds to match animation duration
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-3 flex items-center gap-3">
      <div className="text-zinc-400">
        <Volume2 size={18} />
      </div>
      <div className="flex-1 overflow-hidden whitespace-nowrap relative h-4">
        <AnimatePresence mode="wait">
          <motion.p 
            key={announcement}
            initial={{ x: '100%' }}
            animate={{ x: '-150%' }}
            transition={{ duration: 15, ease: "linear" }}
            className="text-xs text-zinc-300 absolute whitespace-nowrap"
          >
            {announcement}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}

function MusicPlayer() {
  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState('00:00');
  const [error, setError] = useState<string | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  const currentSong = SONGS[currentSongIndex];

  const togglePlay = () => {
    if (!isPlaying) setError(null);
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const current = audioRef.current.currentTime;
    const duration = audioRef.current.duration;
    if (duration) {
      setProgress((current / duration) * 100);
      
      const mins = Math.floor(current / 60);
      const secs = Math.floor(current % 60);
      setCurrentTime(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
    }
  };

  const handleNext = () => {
    setCurrentSongIndex((prev) => (prev + 1) % SONGS.length);
    setError(null);
  };

  const handlePrev = () => {
    setCurrentSongIndex((prev) => (prev - 1 + SONGS.length) % SONGS.length);
    setError(null);
  };

  const handleSongSelect = (index: number) => {
    setCurrentSongIndex(index);
    setError(null);
    setIsPlaying(true); // Auto-play on select
  };

  const handleAudioError = () => {
    if (audioRef.current && audioRef.current.error) {
      const code = audioRef.current.error.code;
      const message = audioRef.current.error.message;
      console.error(`Audio Error Code ${code}: ${message}`);
      
      switch (code) {
        case 1: setError("Playback aborted by user."); break;
        case 2: setError("Network error while loading audio."); break;
        case 3: setError("Audio decoding failed."); break;
        case 4: setError("Audio source not supported or not found."); break;
        default: setError("An unknown audio error occurred.");
      }
    } else {
      setError("Failed to load audio source.");
    }
    setIsPlaying(false);
  };

  useEffect(() => {
    setError(null);
  }, [currentSongIndex]);

  useEffect(() => {
    if (!audioRef.current) return;
    const audio = audioRef.current;

    // Handle song source change
    if (currentSong.audioUrl && audio.src !== currentSong.audioUrl) {
      audio.src = currentSong.audioUrl;
      audio.load();
    }

    if (isPlaying && audio.src) {
      // Small delay to ensure source is ready
      const timer = setTimeout(() => {
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch(e => {
            if (e.name === 'AbortError') {
              console.log("Playback interrupted by new request");
            } else {
              console.error("Playback failed", e);
              setError("Playback failed. Please try another song.");
              setIsPlaying(false);
            }
          });
        }
      }, 100);
      return () => clearTimeout(timer);
    } else {
      audio.pause();
    }
  }, [currentSongIndex, isPlaying]);

  return (
    <div className="space-y-4">
      <audio 
        ref={audioRef} 
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleNext}
        onError={handleAudioError}
        preload="auto"
      />
      
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center justify-between text-red-400 text-xs">
          <div className="flex items-center gap-3">
            <Info size={14} />
            <span>{error}</span>
          </div>
          <button 
            onClick={() => {
              if (audioRef.current) {
                audioRef.current.load();
                setIsPlaying(true);
              }
            }}
            className="px-2 py-1 bg-red-500/20 hover:bg-red-500/30 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      <div className="flex gap-4 items-end">
        <img 
          src={currentSong.cover} 
          alt="Current Song" 
          className="w-32 h-32 rounded-2xl shadow-2xl object-cover"
          referrerPolicy="no-referrer"
        />
        <div className="flex-1 pb-2">
          <h2 className="text-2xl font-bold truncate">{currentSong.title}</h2>
          <p className="text-zinc-400 text-sm">{currentSong.artist}</p>
          <div className="flex items-center justify-between mt-4">
            <span className="text-[10px] text-zinc-500">1.0x</span>
            <div className="flex items-center gap-4">
              <SkipBack 
                size={20} 
                className="text-zinc-400 hover:text-white cursor-pointer transition-colors" 
                onClick={handlePrev}
              />
              <button 
                onClick={togglePlay}
                className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-black hover:scale-105 transition-transform shadow-lg"
              >
                {isPlaying ? <div className="flex gap-1"><div className="w-1 h-4 bg-black rounded-full" /><div className="w-1 h-4 bg-black rounded-full" /></div> : <Play size={20} fill="black" className="ml-1" />}
              </button>
              <SkipForward 
                size={20} 
                className="text-zinc-400 hover:text-white cursor-pointer transition-colors" 
                onClick={handleNext}
              />
            </div>
          </div>
          <div className="mt-2 h-1 bg-zinc-800 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-white rounded-full"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-zinc-500">{currentTime}</span>
            <span className="text-[10px] text-zinc-500">{currentSong.duration}</span>
          </div>
        </div>
      </div>

      {/* Playlist */}
      <div className="space-y-1 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
        {SONGS.map((song, i) => (
          <div 
            key={song.id} 
            onClick={() => handleSongSelect(i)}
            className={`flex items-center gap-4 p-3 rounded-xl transition-all group cursor-pointer border ${currentSongIndex === i ? 'bg-white/10 border-white/20' : 'hover:bg-white/5 border-transparent'}`}
          >
            <div className="relative w-10 h-10 flex-shrink-0">
              <img src={song.cover} alt={song.title} className="w-full h-full rounded-lg object-cover" referrerPolicy="no-referrer" />
              {currentSongIndex === i && isPlaying && (
                <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center">
                  <div className="flex items-end gap-0.5 h-4">
                    <motion.div animate={{ height: [4, 12, 6] }} transition={{ repeat: Infinity, duration: 0.5 }} className="w-1 bg-white" />
                    <motion.div animate={{ height: [12, 4, 10] }} transition={{ repeat: Infinity, duration: 0.6 }} className="w-1 bg-white" />
                    <motion.div animate={{ height: [6, 10, 4] }} transition={{ repeat: Infinity, duration: 0.4 }} className="w-1 bg-white" />
                  </div>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className={`text-sm font-semibold truncate ${currentSongIndex === i ? 'text-white' : 'text-zinc-300'}`}>{song.title}</h4>
              <p className="text-xs text-zinc-500 truncate">{song.artist}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-[10px] text-zinc-500 font-mono">{song.duration}</span>
              {currentSongIndex === i && (
                <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">Playing</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HomeView({ stats, globalSettings, onNavigate }: { stats: UserStats, globalSettings: any, onNavigate: (tab: Tab) => void }) {
  return (
    <div className="px-4 space-y-6">
      {/* Hero Background Effect */}
      <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-blue-900/20 to-transparent -z-10 pointer-events-none" />
      
      {/* Action Grid */}
      <div className="grid grid-cols-4 gap-y-6 pt-4">
        {HOME_ACTIONS.map((action, index) => {
          const Icon = action.icon;
          return (
            <button 
              key={index} 
              onClick={() => {
                if (action.label === 'Deposit') onNavigate('deposit');
                if (action.label === 'Withdraw') onNavigate('withdraw');
                if (action.label === 'Cert') onNavigate('cert');
                if (action.label === 'Contact Us' || action.label === 'Customer Service') {
                  if (globalSettings.contactAddress) {
                    window.open(globalSettings.contactAddress, '_blank');
                  } else {
                    onNavigate('contact');
                  }
                }
                if (action.label === 'T&C') onNavigate('terms');
                if (action.label === 'Album Profit') onNavigate('profit');
                if (action.label === 'FAQ') onNavigate('faq');
                if (action.label === 'About Us') onNavigate('about');
              }}
              className="flex flex-col items-center gap-2 group"
            >
              <div className="w-12 h-12 rounded-xl bg-zinc-900 flex items-center justify-center border border-white/5 group-hover:bg-zinc-800 transition-colors shadow-lg">
                <Icon size={20} className="text-white" />
              </div>
              <span className="text-[10px] font-medium text-zinc-400 text-center leading-tight">
                {action.label}
              </span>
            </button>
          );
        })}
      </div>

      <WithdrawalTicker />

      <MusicPlayer />
    </div>
  );
}

function StartView({ stats, missionCount, maxMissions, onStartMission, onNavigate, globalSettings, setGlobalSuccess }: { 
  stats: UserStats, 
  missionCount: number, 
  maxMissions: number, 
  onStartMission: (amount: number, profit: number, source: 'custom' | 'next' | 'regular') => Promise<void>, 
  onNavigate: (tab: Tab, amount?: number) => void,
  globalSettings: any,
  setGlobalSuccess: (msg: string | null) => void
}) {
  const [flowState, setFlowState] = useState<'idle' | 'rating_submission' | 'please_select' | 'completing' | 'insufficient_balance' | 'task_activation' | 'task_reset_needed'>('idle');
  const [resetStep, setResetStep] = useState<'order_complete' | 'completed' | 'withdraw' | 'contact'>('order_complete');
  const [currentAsset, setCurrentAsset] = useState<(MissionAsset & { source: 'custom' | 'next' | 'regular' }) | null>(null);
  const [selectedRating, setSelectedRating] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleInitialStart = async () => {
    if (missionCount >= maxMissions || stats.hasCompletedTask) {
      setFlowState('task_reset_needed');
      setResetStep('order_complete');
      return;
    }

    if (!stats.taskApproved) {
      setFlowState('task_activation');
      return;
    }
    
    let selectedAsset: MissionAsset & { source: 'custom' | 'next' | 'regular' };
    
    // Check for custom mission for this specific index first
    const customMission = stats.customMissions?.[missionCount];
    
    if (customMission && customMission.amount > 0) {
      selectedAsset = {
        id: 'custom-' + missionCount + '-' + Date.now(),
        name: `Special Mission ${missionCount + 1}`,
        image: 'https://picsum.photos/seed/special/300/300',
        amount: customMission.amount,
        profit: customMission.profit || 0,
        source: 'custom'
      };
    } else if (stats.nextMissionAmount && stats.nextMissionAmount > 0) {
      selectedAsset = {
        id: 'custom-next-' + Date.now(),
        name: 'Special Album Review',
        image: 'https://picsum.photos/seed/special/300/300',
        amount: stats.nextMissionAmount,
        profit: stats.nextMissionProfit || 0,
        source: 'next'
      };
    } else {
      const randomAsset = MISSION_ASSETS[Math.floor(Math.random() * MISSION_ASSETS.length)];
      selectedAsset = { ...randomAsset, source: 'regular' };
    }
    
    if (stats.assetBalance < selectedAsset.amount) {
      setCurrentAsset(selectedAsset);
      setFlowState('insufficient_balance');
      return;
    }

    setCurrentAsset(selectedAsset);
    setFlowState('rating_submission');
  };

  const handleSubmitRating = () => {
    setFlowState('please_select');
  };

  const handleFinalSubmit = async () => {
    if (!selectedRating || !currentAsset) return;
    setLoading(true);
    try {
      await onStartMission(currentAsset.amount, currentAsset.profit, currentAsset.source);
      setGlobalSuccess(`Mission completed successfully! You earned ${currentAsset.profit}$ profit.`);
      setFlowState('idle');
      setCurrentAsset(null);
      setSelectedRating(null);
    } catch (err: any) {
      // Error handled by global error state in onStartMission
    } finally {
      setLoading(false);
    }
  };

  const handleDepositClick = () => {
    if (currentAsset) {
      const shortfall = Math.max(0, currentAsset.amount - stats.assetBalance);
      onNavigate('deposit', shortfall);
    } else {
      onNavigate('deposit');
    }
  };

  return (
    <div className="px-4 space-y-8 relative">
      {/* Header Info */}
      <div className="flex items-center justify-between pt-4">
        <h2 className="text-2xl font-bold">Start Mission</h2>
        <button className="text-sm text-zinc-500 flex items-center gap-1">
          Dealing Slip <ChevronRight size={16} />
        </button>
      </div>

      {/* Stats Cards */}
      <div className="bg-zinc-900/80 border border-white/5 rounded-3xl p-6 space-y-6 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-500">
              <TrendingUp size={20} />
            </div>
            <span className="text-zinc-300 font-medium">Daily Profit</span>
          </div>
          <span className="text-xl font-bold">{stats.dailyProfit.toFixed(2)} $</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center text-orange-500">
              <Gift size={20} />
            </div>
            <span className="text-zinc-300 font-medium">Today's Bonus</span>
          </div>
          <span className="text-xl font-bold">{stats.todayBonus.toFixed(2)} $</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-500">
              <Wallet size={20} />
            </div>
            <span className="text-zinc-300 font-medium">Asset Balance</span>
          </div>
          <span className="text-xl font-bold">{stats.assetBalance.toFixed(2)} $</span>
        </div>
      </div>

      <button 
        onClick={handleInitialStart}
        className={`w-full py-4 transition-all rounded-2xl font-bold text-lg shadow-lg ${
          stats.hasCompletedTask || missionCount >= maxMissions
            ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20' 
            : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/20'
        } active:scale-[0.98]`}
      >
        {stats.hasCompletedTask || missionCount >= maxMissions ? 'Completed' : `Start Mission ( ${missionCount} / ${maxMissions} )`}
      </button>

      {/* Premium Membership */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold">Premium Membership</h3>
          <button className="text-sm text-zinc-500 flex items-center gap-1">
            More <ChevronRight size={16} />
          </button>
        </div>

        <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-3xl -z-10" />
          
          <div className="flex justify-between items-start mb-6">
            <div>
              <h4 className="text-xl font-bold">Junior Music Critic</h4>
              <p className="text-xs text-blue-500 mt-1">(Current Level)</p>
            </div>
            <div className="w-16 h-16 relative">
              <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full" />
              <Shield size={64} className="text-zinc-300 relative z-10" strokeWidth={1} />
              <div className="absolute inset-0 flex items-center justify-center z-20">
                <div className="w-4 h-4 bg-blue-500 rotate-45 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
              </div>
            </div>
          </div>

          <ul className="space-y-3 text-sm text-zinc-400">
            <li className="flex items-start gap-2">
              <Circle size={6} fill="currentColor" className="mt-1.5 flex-shrink-0" />
              <span>Repeat selections are allowed, up to 2 times per day.</span>
            </li>
            <li className="flex items-start gap-2">
              <Circle size={6} fill="currentColor" className="mt-1.5 flex-shrink-0" />
              <span>Minimum activation amount: 50 USDT</span>
            </li>
            <li className="flex items-start gap-2">
              <Circle size={6} fill="currentColor" className="mt-1.5 flex-shrink-0" />
              <span>25 ratings, commission...</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {flowState === 'task_activation' && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
              onClick={() => setFlowState('idle')}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-[#121212] border border-white/10 rounded-[2.5rem] p-8 shadow-2xl text-center"
            >
              <div className="w-20 h-20 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-500 mx-auto mb-6">
                <ShieldAlert size={40} />
              </div>
              <h3 className="text-2xl font-black mb-2">Activate Task</h3>
              <p className="text-zinc-500 text-sm mb-8">
                To start your first mission, you must review and agree to our task contract.
              </p>
              
              <div className="space-y-4">
                <a 
                  href={globalSettings.taskActivationLink || '#'} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2"
                >
                  <FileText size={18} className="text-orange-500" />
                  View Task Contract
                </a>
                
                <p className="text-[10px] text-zinc-600 uppercase font-bold tracking-widest">
                  After viewing, please contact admin for approval
                </p>

                <button 
                  onClick={() => setFlowState('idle')}
                  className="w-full py-4 bg-zinc-800 hover:bg-zinc-700 rounded-2xl font-bold text-sm transition-all"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {flowState === 'task_reset_needed' && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
              onClick={() => setFlowState('idle')}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-[#121212] border border-white/10 rounded-[2.5rem] p-8 shadow-2xl text-center"
            >
              <div className="w-20 h-20 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500 mx-auto mb-6">
                <RefreshCw size={40} />
              </div>

              {resetStep === 'order_complete' && (
                <div onClick={() => setResetStep('completed')} className="cursor-pointer group">
                  <h3 className="text-2xl font-black mb-2 group-hover:text-blue-500 transition-colors">Order Complete</h3>
                  <p className="text-zinc-500 text-sm mb-8 italic">Click to continue</p>
                </div>
              )}

              {resetStep === 'completed' && (
                <div onClick={() => {
                  if (stats.assetBalance > 0) {
                    setResetStep('withdraw');
                  } else {
                    setResetStep('contact');
                  }
                }} className="cursor-pointer group">
                  <h3 className="text-2xl font-black mb-2 group-hover:text-blue-500 transition-colors">Completed</h3>
                  <p className="text-zinc-500 text-sm mb-8 italic">Click to continue</p>
                </div>
              )}

              {resetStep === 'withdraw' && (
                <div>
                  <h3 className="text-2xl font-black mb-2">Withdraw Needed</h3>
                  <p className="text-zinc-500 text-sm mb-8">
                    Please withdraw your full balance of {stats.assetBalance.toFixed(2)}$ before resetting tasks.
                  </p>
                  <div className="space-y-4">
                    <button 
                      onClick={() => {
                        setFlowState('idle');
                        onNavigate('withdraw');
                      }}
                      className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-2xl font-bold text-sm transition-all shadow-lg shadow-blue-600/20 text-center"
                    >
                      Go to Withdraw
                    </button>
                    <button 
                      onClick={() => setFlowState('idle')}
                      className="w-full py-4 bg-zinc-800 hover:bg-zinc-700 rounded-2xl font-bold text-sm transition-all"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}

              {resetStep === 'contact' && (
                <div>
                  <h3 className="text-2xl font-black mb-2">Task Reset Needed</h3>
                  <p className="text-zinc-500 text-sm mb-8">
                    Please contact customer service to reset your tasks.
                  </p>
                  <div className="space-y-4">
                    <a 
                      href={globalSettings.customerCareLink || '#'} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="block w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-2xl font-bold text-sm transition-all shadow-lg shadow-blue-600/20 text-center"
                    >
                      Contact
                    </a>
                    <button 
                      onClick={() => setFlowState('idle')}
                      className="w-full py-4 bg-zinc-800 hover:bg-zinc-700 rounded-2xl font-bold text-sm transition-all"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}

        {flowState === 'insufficient_balance' && currentAsset && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setFlowState('idle')}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm bg-zinc-900 rounded-[2rem] p-8 shadow-2xl border border-white/10 text-center"
            >
              <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Wallet size={40} className="text-amber-500" />
              </div>
              <h3 className="text-2xl font-bold mb-4">Insufficient Balance</h3>
              <p className="text-zinc-400 mb-8">
                Your current balance is not enough to complete this mission. You need <span onClick={handleDepositClick} className="text-white font-bold cursor-pointer hover:text-blue-400 transition-colors underline underline-offset-4 decoration-white/20">{currentAsset.amount}$</span> but only have <span className="text-white font-bold">{stats.assetBalance.toFixed(2)}$</span>.
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setFlowState('idle')}
                  className="flex-1 py-4 bg-zinc-800 hover:bg-zinc-700 transition-colors rounded-2xl font-bold"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDepositClick}
                  className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 transition-colors rounded-2xl font-bold shadow-lg shadow-blue-600/20"
                >
                  Deposit
                </button>
              </div>
            </motion.div>
          </div>
        )}        {flowState === 'rating_submission' && currentAsset && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setFlowState('idle')}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm bg-zinc-900 rounded-[2rem] overflow-hidden shadow-2xl border border-white/10"
            >
              <div className="p-6 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-center flex-1">Rating Submission</h3>
                  <button onClick={() => setFlowState('idle')} className="text-zinc-500 hover:text-white transition-colors">
                    <X size={24} />
                  </button>
                </div>

                <div className="flex flex-col items-center gap-4 mb-6">
                  <img 
                    src={currentAsset.image} 
                    alt={currentAsset.name} 
                    className="w-24 h-24 rounded-2xl object-cover shadow-lg"
                    referrerPolicy="no-referrer"
                  />
                  <h4 className="text-xl font-bold text-center">{currentAsset.name}</h4>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-zinc-400 text-sm">Total Amount</span>
                    <span className="text-lg font-bold">{currentAsset.amount} $</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-zinc-400 text-sm">Profit</span>
                    <span className="text-lg font-bold text-blue-500">{currentAsset.profit} $</span>
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Select Rating</p>
                  {RATING_OPTIONS.map((option) => (
                    <button 
                      key={option.id}
                      onClick={() => setSelectedRating(option.id)}
                      className={`w-full p-3 rounded-xl border transition-all flex items-center gap-3 text-left ${selectedRating === option.id ? 'bg-blue-600/10 border-blue-500' : 'bg-black/40 border-white/5 hover:border-white/10'}`}
                    >
                      <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${selectedRating === option.id ? 'border-blue-500' : 'border-zinc-700'}`}>
                        {selectedRating === option.id && <div className="w-2 h-2 bg-blue-500 rounded-full" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex gap-0.5 mb-0.5">
                          {[...Array(option.stars)].map((_, i) => (
                            <Star key={i} size={10} fill="#EAB308" className="text-yellow-500" />
                          ))}
                        </div>
                        <p className="text-[10px] text-zinc-400 line-clamp-1">{option.text}</p>
                      </div>
                    </button>
                  ))}
                </div>

                <button 
                  onClick={handleFinalSubmit}
                  disabled={!selectedRating || loading}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] transition-all rounded-2xl font-bold text-lg shadow-lg shadow-blue-600/20 disabled:opacity-50"
                >
                  {loading ? 'Processing...' : 'Submit Rating'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Removed full-screen loading animation as requested */}
      </AnimatePresence>
    </div>
  );
}

function ProfileView({ stats, onNavigate, onLogout, setGlobalSuccess }: { stats: UserStats, onNavigate: (tab: Tab) => void, onLogout: () => void, setGlobalSuccess: (msg: string | null) => void }) {
  return (
    <div className="px-4 space-y-6">
      {/* User Info Header */}
      <div className="flex flex-col items-center pt-8 pb-4">
        <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center text-3xl font-bold shadow-2xl mb-4 border-4 border-zinc-900">
          {stats.username.charAt(0).toUpperCase()}.
        </div>
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold">{stats.username}</h2>
          <div className="flex items-center gap-1 bg-zinc-800 px-2 py-0.5 rounded text-[10px] font-bold text-zinc-300">
            <Shield size={10} fill="currentColor" />
            {stats.level}
          </div>
          {(stats.role === 'admin' || stats.role === 'sub-admin') && (
            <div className={`${stats.role === 'admin' ? 'bg-red-600' : 'bg-blue-600'} px-2 py-0.5 rounded text-[10px] font-bold text-white uppercase`}>
              {stats.role === 'admin' ? 'Admin' : 'Sub-Admin'}
            </div>
          )}
        </div>
        
        <p className="text-sm mt-2">
          <span className="text-zinc-400">Credit: </span>
          <span className="text-blue-500 font-bold">{stats.credit}</span>
        </p>

        {stats.referralEnabled && stats.referralCode && (
          <div className="mt-2 flex items-center gap-2 bg-zinc-900/50 px-4 py-2 rounded-full border border-white/5">
            <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Code: </span>
            <span className="text-blue-500 font-black tracking-tighter">{stats.referralCode}</span>
            <button 
              onClick={() => {
                navigator.clipboard.writeText(stats.referralCode || '');
                setGlobalSuccess('Referral code copied to clipboard!');
              }}
              className="text-zinc-500 hover:text-white transition-colors"
            >
              <Copy size={14} />
            </button>
          </div>
        )}

        {(stats.role === 'admin' || stats.role === 'sub-admin') && (
          <button 
            onClick={() => onNavigate('admin')}
            className="mt-4 px-6 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-full text-xs font-bold transition-colors"
          >
            Admin Dashboard
          </button>
        )}
      </div>

      {/* Financial Stats Card */}
      <div className="bg-zinc-900/80 border border-white/5 rounded-3xl p-6 grid grid-cols-3 gap-4 shadow-xl">
        <div className="flex flex-col items-center text-center gap-2">
          <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500">
            <TrendingUp size={20} />
          </div>
          <p className="text-[10px] text-zinc-500 leading-tight">Total Commission</p>
          <p className="text-sm font-bold">${stats.totalCommission.toFixed(2)}</p>
        </div>

        <div className="flex flex-col items-center text-center gap-2">
          <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500">
            <Wallet size={20} />
          </div>
          <p className="text-[10px] text-zinc-500 leading-tight">Available Balance</p>
          <p className="text-sm font-bold">${stats.assetBalance.toFixed(2)}</p>
        </div>

        <div className="flex flex-col items-center text-center gap-2">
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500">
            <Gift size={20} />
          </div>
          <p className="text-[10px] text-zinc-500 leading-tight">Today's Bonus</p>
          <p className="text-sm font-bold">${stats.todayBonus.toFixed(2)}</p>
        </div>
      </div>

      {/* Common Functions */}
      <div className="bg-zinc-900/50 border border-white/5 rounded-3xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5">
          <h3 className="font-bold">Common Functions</h3>
        </div>
        <div className="divide-y divide-white/5">
          {PROFILE_FUNCTIONS.map((func, index) => {
            const Icon = func.icon;
            const isLogout = func.label === 'Logout';
            return (
              <button 
                key={index} 
                onClick={() => {
                  if (func.label === 'Deposit') onNavigate('deposit');
                  if (func.label === 'Withdraw') onNavigate('withdraw');
                  if (func.label === 'Security') onNavigate('security');
                  if (func.label === 'Transactions') onNavigate('transactions');
                  if (func.label === 'Commission') onNavigate('commissions');
                  if (func.label === 'Logout') onLogout();
                }}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/5 transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center transition-colors ${isLogout ? 'text-red-500' : 'text-zinc-400 group-hover:text-white'}`}>
                    <Icon size={18} />
                  </div>
                  <span className={`text-sm font-medium transition-colors ${isLogout ? 'text-red-500' : 'text-zinc-300 group-hover:text-white'}`}>{func.label}</span>
                </div>
                <ChevronRight size={18} className={`transition-colors ${isLogout ? 'text-red-900' : 'text-zinc-600 group-hover:text-zinc-400'}`} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MessagesView({ messages, onBack, onMarkAsRead }: { messages: Message[], onBack: () => void, onMarkAsRead: (id: string) => void }) {
  return (
    <div className="min-h-screen bg-black text-white pb-24">
      <div className="sticky top-0 z-50 bg-black/80 backdrop-blur-md border-b border-white/5 px-4 h-14 flex items-center justify-between">
        <button onClick={onBack} className="p-2 hover:bg-white/5 rounded-full transition-colors">
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-lg font-bold">Messages</h2>
        <div className="w-10" />
      </div>

      <div className="p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
            <MessageSquare size={48} className="mb-4 opacity-20" />
            <p>No messages yet</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div 
              key={msg.id} 
              onClick={() => onMarkAsRead(msg.id)}
              className={`p-5 rounded-2xl border transition-all ${msg.isRead ? 'bg-zinc-900/30 border-white/5' : 'bg-zinc-900 border-blue-500/30 shadow-lg shadow-blue-500/5'}`}
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className={`font-bold ${msg.isRead ? 'text-zinc-300' : 'text-white'}`}>{msg.title}</h3>
                {!msg.isRead && <div className="w-2 h-2 bg-blue-500 rounded-full" />}
              </div>
              <p className="text-sm text-zinc-400 mb-4 leading-relaxed">{msg.content}</p>
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-zinc-600 font-mono uppercase tracking-widest">
                  {new Date(msg.timestamp).toLocaleString()}
                </span>
                <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-tighter ${
                  msg.type === 'system' ? 'bg-blue-500/10 text-blue-500' : 
                  msg.type === 'bonus' ? 'bg-emerald-500/10 text-emerald-500' : 
                  'bg-zinc-500/10 text-zinc-500'
                }`}>
                  {msg.type}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function AdminDashboard({ onBack, onLogout, setGlobalSuccess, setGlobalError, stats }: { onBack: () => void, onLogout: () => void, setGlobalSuccess: (msg: string | null) => void, setGlobalError: (msg: string | null) => void, stats: UserStats }) {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingUser, setEditingUser] = useState<any | null>(null);

  useEffect(() => {
    if (!auth.currentUser || (stats.role !== 'admin' && stats.role !== 'sub-admin')) return;

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usersData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    const unsubTransactions = onSnapshot(collectionGroup(db, 'transactions'), (snapshot) => {
      const txData = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        userId: doc.ref.parent.parent?.id,
        ...doc.data() 
      }));
      setTransactions(txData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'transactions');
    });

    return () => {
      unsubUsers();
      unsubTransactions();
    };
  }, [stats.role]);

  const handleUpdateTransactionStatus = async (tx: any, newStatus: 'completed' | 'failed') => {
    if (!tx.userId) return;
    const path = `users/${tx.userId}/transactions/${tx.id}`;
    try {
      await updateDoc(doc(db, path), { status: newStatus });
      
      // If it's a deposit and we're completing it, we might want to update user balance
      // But usually this should be handled by a cloud function or similar.
      // For this demo, we'll update it here if it's a deposit.
      if (tx.type === 'deposit' && newStatus === 'completed') {
        const userRef = doc(db, `users/${tx.userId}`);
        await updateDoc(userRef, {
          assetBalance: increment(tx.amount)
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    
    // Sub-admins cannot change roles
    if (stats.role === 'sub-admin' && editingUser.role !== users.find(u => u.id === editingUser.id)?.role) {
      setGlobalError('Only full admins can change user roles');
      return;
    }

    const path = `users/${editingUser.id}`;
    try {
      const { id, ...data } = editingUser;
        const sanitizedData = {
          ...data,
          assetBalance: Number(data.assetBalance),
          dailyProfit: Number(data.dailyProfit),
          todayBonus: Number(data.todayBonus),
          totalCommission: Number(data.totalCommission),
          musicAssets: Number(data.musicAssets),
          credit: Number(data.credit),
          missionCount: Number(data.missionCount),
          maxMissions: Number(data.maxMissions || 25),
          nextMissionAmount: Number(data.nextMissionAmount || 0),
          nextMissionProfit: Number(data.nextMissionProfit || 0),
          referralEnabled: Boolean(data.referralEnabled),
          referralLimit: Number(data.referralLimit || 0),
          referralUsageCount: Number(data.referralUsageCount || 0),
          taskApproved: Boolean(data.taskApproved),
          hasCompletedTask: Boolean(data.hasCompletedTask),
          customMissions: (data.customMissions || []).map((m: any) => ({
            amount: Number(m.amount || 0),
            profit: Number(m.profit || 0)
          }))
        };
      await setDoc(doc(db, path), sanitizedData, { merge: true });
      setEditingUser(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const adminStats = {
    totalUsers: users.length,
    totalMissions: users.reduce((acc, u) => acc + (u.missionCount || 0), 0),
    pendingDeposits: transactions.filter(t => t.type === 'deposit' && t.status === 'pending').length,
    totalDeposits: transactions.filter(t => t.type === 'deposit' && t.status === 'completed').reduce((acc, t) => acc + t.amount, 0),
    totalWithdrawals: transactions.filter(t => t.type === 'withdraw' && t.status === 'completed').reduce((acc, t) => acc + t.amount, 0),
    totalRevenue: users.reduce((acc, u) => acc + (u.totalCommission || 0), 0),
    pendingWithdrawals: transactions.filter(t => t.type === 'withdraw' && t.status === 'pending').length,
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'deposits', label: 'Deposits', icon: Wallet },
    { id: 'withdrawals', label: 'Withdrawals', icon: ArrowUpCircle },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const renderDashboard = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-zinc-900/80 p-6 rounded-2xl border border-white/5 flex items-center gap-4 shadow-lg">
          <div className="w-14 h-14 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500">
            <Users size={28} />
          </div>
          <div>
            <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Total Users</p>
            <p className="text-2xl font-bold">{adminStats.totalUsers}</p>
          </div>
        </div>
        <div className="bg-zinc-900/80 p-6 rounded-2xl border border-white/5 flex items-center gap-4 shadow-lg">
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
            <Wallet size={28} />
          </div>
          <div>
            <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Total Deposits</p>
            <p className="text-2xl font-bold">${adminStats.totalDeposits.toFixed(0)}</p>
          </div>
        </div>
        <div className="bg-zinc-900/80 p-6 rounded-2xl border border-white/5 flex items-center gap-4 shadow-lg">
          <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
            <ArrowUpCircle size={28} />
          </div>
          <div>
            <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Total Withdrawals</p>
            <p className="text-2xl font-bold">${adminStats.totalWithdrawals.toFixed(0)}</p>
          </div>
        </div>
        <div className="bg-zinc-900/80 p-6 rounded-2xl border border-white/5 flex items-center gap-4 shadow-lg">
          <div className="w-14 h-14 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500">
            <Clock size={28} />
          </div>
          <div>
            <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Pending Deposits</p>
            <p className="text-2xl font-bold">{adminStats.pendingDeposits}</p>
          </div>
        </div>
        <div className="bg-zinc-900/80 p-6 rounded-2xl border border-white/5 flex items-center gap-4 shadow-lg">
          <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
            <ArrowUpCircle size={28} />
          </div>
          <div>
            <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Pending Withdraw</p>
            <p className="text-2xl font-bold">{adminStats.pendingWithdrawals}</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderUsers = () => (
    <div className="space-y-4">
      <div className="bg-zinc-900/50 p-6 rounded-2xl border border-white/5 mb-6">
        <h3 className="text-xl font-bold mb-2">User Management</h3>
        <div className="mt-4 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
          <input 
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-800 border border-white/5 rounded-xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-orange-500 transition-colors"
          />
        </div>
      </div>
      <div className="space-y-4">
        {users.filter(u => u.username?.toLowerCase().includes(searchQuery.toLowerCase())).map(user => (
          <div key={user.id} className="bg-zinc-900/80 p-5 rounded-2xl border border-white/5 flex flex-col gap-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-bold text-lg">{user.username}</p>
                <p className="text-xs text-zinc-500">{user.email}</p>
              </div>
              <button 
                onClick={() => setEditingUser(user)}
                className="p-2 bg-orange-500/10 text-orange-500 rounded-xl hover:bg-orange-500/20 transition-colors"
              >
                <Edit2 size={16} />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-black/20 p-2 rounded-lg border border-white/5 text-center">
                <p className="text-[8px] text-zinc-500 uppercase font-bold">Balance</p>
                <p className="text-xs font-bold text-emerald-500">${(user.assetBalance || 0).toFixed(2)}</p>
              </div>
              <div className="bg-black/20 p-2 rounded-lg border border-white/5 text-center">
                <p className="text-[8px] text-zinc-500 uppercase font-bold">Missions</p>
                <p className="text-xs font-bold text-blue-500">{user.missionCount || 0}</p>
              </div>
              <div className="bg-black/20 p-2 rounded-lg border border-white/5 text-center">
                <p className="text-[8px] text-zinc-500 uppercase font-bold">Bonus</p>
                <p className={`text-xs font-bold ${user.bonusClaimed ? 'text-emerald-500' : 'text-zinc-500'}`}>
                  {user.bonusClaimed ? 'Claimed' : 'Pending'}
                </p>
              </div>
              <div className="bg-black/20 p-2 rounded-lg border border-white/5 text-center">
                <p className="text-[8px] text-zinc-500 uppercase font-bold">Level</p>
                <p className="text-xs font-bold text-zinc-300">{user.level || 'LV1'}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderTransactions = (type: 'deposit' | 'withdraw') => (
    <div className="space-y-4">
      <div className="bg-zinc-900/50 p-6 rounded-2xl border border-white/5 mb-6">
        <h3 className="text-xl font-bold mb-2 capitalize">{type} Management</h3>
        <p className="text-sm text-zinc-400">Approve or reject pending {type}s.</p>
      </div>
      <div className="space-y-4">
        {transactions.filter(t => t.type === type).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map(tx => {
          const user = users.find(u => u.id === tx.userId);
          return (
            <div key={tx.id} className="bg-zinc-900/80 p-5 rounded-2xl border border-white/5 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold">{user?.username || 'Unknown User'}</p>
                  <p className="text-xs text-zinc-500">{new Date(tx.timestamp).toLocaleString()}</p>
                </div>
                <p className={`font-bold text-lg ${type === 'deposit' ? 'text-emerald-500' : 'text-red-500'}`}>
                  ${tx.amount.toFixed(2)}
                </p>
              </div>

              {type === 'deposit' && tx.hashId && (
                <div className="bg-black/40 p-3 rounded-xl border border-white/5 space-y-2">
                  <div>
                    <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mb-1">Platform Deposit Address</p>
                    <p className="text-xs font-mono text-zinc-300 break-all">{tx.depositAddress || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mb-1">User Transaction Hash</p>
                    <p className="text-xs font-mono text-zinc-300 break-all">{tx.hashId}</p>
                  </div>
                </div>
              )}

              {type === 'withdraw' && tx.withdrawalAddress && (
                <div className="bg-black/40 p-3 rounded-xl border border-white/5">
                  <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mb-1">Withdrawal Address</p>
                  <p className="text-xs font-mono text-zinc-300 break-all">{tx.withdrawalAddress}</p>
                </div>
              )}

              {tx.status === 'pending' ? (
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleUpdateTransactionStatus(tx, 'completed')}
                    className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-bold transition-colors"
                  >
                    Approve
                  </button>
                  <button 
                    onClick={() => handleUpdateTransactionStatus(tx, 'failed')}
                    className="flex-1 py-2 bg-red-600 hover:bg-red-500 rounded-xl text-xs font-bold transition-colors"
                  >
                    Reject
                  </button>
                </div>
              ) : (
                <div className={`py-2 rounded-xl text-center text-xs font-bold uppercase ${
                  tx.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
                }`}>
                  {tx.status}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const [globalSettings, setGlobalSettings] = useState({ 
    depositAddress: '', 
    contactAddress: '',
    bonusThreshold: 40,
    bonusAmount: 10,
    referralSystemEnabled: false,
    taskActivationLink: '',
    customerCareLink: ''
  });
  const [settingsLoading, setSettingsLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'settings') {
      const fetchSettings = async () => {
        const settingsDoc = await getDoc(doc(db, 'config', 'settings'));
        if (settingsDoc.exists()) {
          setGlobalSettings(settingsDoc.data() as any);
        }
      };
      fetchSettings();
    }
  }, [activeTab]);

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (stats.role === 'sub-admin') {
      setGlobalError('Only full admins can update settings');
      return;
    }
    setSettingsLoading(true);
    try {
      await setDoc(doc(db, 'config', 'settings'), globalSettings);
      await setDoc(doc(db, 'config', 'referral'), {
        referralSystemEnabled: globalSettings.referralSystemEnabled
      });
      setGlobalSuccess('Settings updated successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'config/settings');
    } finally {
      setSettingsLoading(false);
    }
  };



  const renderSettings = () => (
    <div className="space-y-6">
      <div className="bg-zinc-900/50 p-6 rounded-2xl border border-white/5">
        <h3 className="text-xl font-bold mb-2">Global Settings</h3>
        <p className="text-sm text-zinc-400">Configure platform-wide parameters.</p>
      </div>

      <form onSubmit={handleUpdateSettings} className="bg-zinc-900/80 p-6 rounded-2xl border border-white/5 space-y-6">
        {stats.role === 'sub-admin' && (
          <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-center gap-3 text-red-500">
            <AlertTriangle size={20} />
            <p className="text-xs font-bold uppercase tracking-widest">Read-Only Mode: Only full admins can modify these settings.</p>
          </div>
        )}
        <div className="space-y-2">
          <label className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Global Deposit Address (TRC-20)</label>
          <input 
            type="text"
            disabled={stats.role === 'sub-admin'}
            value={globalSettings.depositAddress}
            onChange={(e) => setGlobalSettings({ ...globalSettings, depositAddress: e.target.value })}
            placeholder="Enter USDT TRC-20 Address"
            className={`w-full bg-black border border-white/5 rounded-xl p-4 text-sm focus:outline-none focus:border-orange-500 transition-colors ${stats.role === 'sub-admin' ? 'opacity-50 cursor-not-allowed' : ''}`}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Contact Address (Telegram/WhatsApp)</label>
          <input 
            type="text"
            disabled={stats.role === 'sub-admin'}
            value={globalSettings.contactAddress || ''}
            onChange={(e) => setGlobalSettings({ ...globalSettings, contactAddress: e.target.value })}
            placeholder="Enter Telegram or WhatsApp link"
            className={`w-full bg-black border border-white/5 rounded-xl p-4 text-sm focus:outline-none focus:border-orange-500 transition-colors ${stats.role === 'sub-admin' ? 'opacity-50 cursor-not-allowed' : ''}`}
          />
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div className="flex items-center justify-between bg-black/40 p-4 rounded-xl border border-white/5">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest">Referral System</p>
              <p className="text-[10px] text-zinc-500">{globalSettings.referralSystemEnabled ? 'Enabled (Required for 2nd user+)' : 'Disabled'}</p>
            </div>
            <button 
              type="button"
              disabled={stats.role === 'sub-admin'}
              onClick={() => setGlobalSettings({ ...globalSettings, referralSystemEnabled: !globalSettings.referralSystemEnabled })}
              className={`w-10 h-5 rounded-full relative transition-colors ${globalSettings.referralSystemEnabled ? 'bg-orange-500' : 'bg-zinc-700'}`}
            >
              <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${globalSettings.referralSystemEnabled ? 'translate-x-5' : ''}`} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Daily Bonus Threshold (Tasks)</label>
            <input 
              type="number"
              disabled={stats.role === 'sub-admin'}
              value={globalSettings.bonusThreshold || 40}
              onChange={(e) => setGlobalSettings({ ...globalSettings, bonusThreshold: Number(e.target.value) })}
              placeholder="40"
              className={`w-full bg-black border border-white/5 rounded-xl p-4 text-sm focus:outline-none focus:border-orange-500 transition-colors ${stats.role === 'sub-admin' ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Daily Bonus Amount ($)</label>
            <input 
              type="number"
              disabled={stats.role === 'sub-admin'}
              value={globalSettings.bonusAmount || 10}
              onChange={(e) => setGlobalSettings({ ...globalSettings, bonusAmount: Number(e.target.value) })}
              placeholder="10"
              className={`w-full bg-black border border-white/5 rounded-xl p-4 text-sm focus:outline-none focus:border-orange-500 transition-colors ${stats.role === 'sub-admin' ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Default Max Missions (Per Day)</label>
          <input 
            type="number"
            disabled={stats.role === 'sub-admin'}
            value={globalSettings.defaultMaxMissions || 25}
            onChange={(e) => setGlobalSettings({ ...globalSettings, defaultMaxMissions: Number(e.target.value) })}
            placeholder="25"
            className={`w-full bg-black border border-white/5 rounded-xl p-4 text-sm focus:outline-none focus:border-orange-500 transition-colors ${stats.role === 'sub-admin' ? 'opacity-50 cursor-not-allowed' : ''}`}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Task Activation Link (Contract)</label>
          <input 
            type="url"
            disabled={stats.role === 'sub-admin'}
            value={globalSettings.taskActivationLink || ''}
            onChange={(e) => setGlobalSettings({ ...globalSettings, taskActivationLink: e.target.value })}
            placeholder="https://example.com/contract"
            className={`w-full bg-black border border-white/5 rounded-xl p-4 text-sm focus:outline-none focus:border-orange-500 transition-colors ${stats.role === 'sub-admin' ? 'opacity-50 cursor-not-allowed' : ''}`}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Customer Care Link</label>
          <input 
            type="url"
            disabled={stats.role === 'sub-admin'}
            value={globalSettings.customerCareLink || ''}
            onChange={(e) => setGlobalSettings({ ...globalSettings, customerCareLink: e.target.value })}
            placeholder="https://t.me/support"
            className={`w-full bg-black border border-white/5 rounded-xl p-4 text-sm focus:outline-none focus:border-orange-500 transition-colors ${stats.role === 'sub-admin' ? 'opacity-50 cursor-not-allowed' : ''}`}
          />
        </div>

        <button 
          type="submit"
          disabled={settingsLoading || stats.role === 'sub-admin'}
          className="w-full py-4 bg-orange-600 hover:bg-orange-500 rounded-xl font-bold transition-all disabled:opacity-50"
        >
          {settingsLoading ? 'Saving...' : 'Save Settings'}
        </button>
      </form>


    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex">
      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 w-72 bg-[#121212] border-r border-white/5 z-[70] transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-6 flex flex-col h-full">
          <div className="flex items-center justify-between mb-10">
            <h1 className="text-2xl font-black tracking-tighter">
              <span className="text-orange-500">DREAM</span>ADMIN
            </h1>
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 hover:bg-white/5 rounded-full">
              <X size={20} />
            </button>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto pr-2 custom-scrollbar">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id as AdminTab);
                  setIsSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                  activeTab === item.id 
                    ? 'bg-orange-500 text-white shadow-[0_4px_20px_rgba(249,115,22,0.3)]' 
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                }`}
              >
                <item.icon size={20} />
                {item.label}
              </button>
            ))}
          </nav>

          <div className="mt-auto space-y-2">
            <button 
              onClick={onBack}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold text-zinc-400 hover:bg-white/5 transition-colors"
            >
              <ArrowRight size={20} className="rotate-180" />
              Exit Admin
            </button>
            <button 
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold text-red-500 hover:bg-red-500/10 transition-colors"
            >
              <LogOut size={20} />
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="h-16 flex items-center justify-between px-6 border-b border-white/5 bg-[#121212]/50 backdrop-blur-md sticky top-0 z-50">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 hover:bg-white/5 rounded-full text-orange-500">
              <Menu size={24} />
            </button>
            <div>
              <h2 className="text-lg font-bold capitalize">{activeTab}</h2>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Overview of your platform</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center font-black text-white shadow-lg">
              A
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-zinc-500 font-bold animate-pulse">Loading DreamAdmin...</p>
            </div>
          ) : (
            <div className="max-w-6xl mx-auto">
              {activeTab === 'dashboard' && renderDashboard()}
              {activeTab === 'users' && renderUsers()}
              {activeTab === 'deposits' && renderTransactions('deposit')}
              {activeTab === 'withdrawals' && renderTransactions('withdraw')}
              {activeTab === 'settings' && renderSettings()}
              {(activeTab !== 'dashboard' && activeTab !== 'users' && activeTab !== 'deposits' && activeTab !== 'withdrawals' && activeTab !== 'settings') && (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                  <div className="w-20 h-20 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-700">
                    <Settings size={40} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold capitalize">{activeTab} View</h3>
                    <p className="text-zinc-500 text-sm">This module is currently under development.</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Edit User Modal */}
      <AnimatePresence>
        {editingUser && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
              onClick={() => setEditingUser(null)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-[#121212] border border-white/10 rounded-[2.5rem] p-8 shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-2xl font-black">Edit User</h3>
                  <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">{editingUser.username}</p>
                </div>
                <button onClick={() => setEditingUser(null)} className="p-2 hover:bg-white/5 rounded-full text-zinc-500">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleUpdateUser} className="space-y-6">
                {stats.role === 'sub-admin' && (
                  <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-center gap-3 text-red-500">
                    <AlertTriangle size={20} />
                    <p className="text-xs font-bold uppercase tracking-widest">Read-Only Mode: Only full admins can modify user data.</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Username</label>
                    <input 
                      type="text"
                      value={editingUser.username}
                      onChange={(e) => setEditingUser({...editingUser, username: e.target.value})}
                      className="w-full bg-black border border-white/5 rounded-2xl py-3 px-4 text-sm focus:border-orange-500 transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Email</label>
                    <input 
                      type="email"
                      value={editingUser.email}
                      onChange={(e) => setEditingUser({...editingUser, email: e.target.value})}
                      className="w-full bg-black border border-white/5 rounded-2xl py-3 px-4 text-sm focus:border-orange-500 transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Asset Balance ($)</label>
                    <input 
                      type="number"
                      step="0.01"
                      value={editingUser.assetBalance}
                      onChange={(e) => setEditingUser({...editingUser, assetBalance: e.target.value})}
                      className="w-full bg-black border border-white/5 rounded-2xl py-3 px-4 text-sm text-emerald-500 font-bold focus:border-orange-500 transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Credit Score</label>
                    <input 
                      type="number"
                      value={editingUser.credit}
                      onChange={(e) => setEditingUser({...editingUser, credit: e.target.value})}
                      className="w-full bg-black border border-white/5 rounded-2xl py-3 px-4 text-sm text-blue-500 font-bold focus:border-orange-500 transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Level</label>
                    <select 
                      value={editingUser.level}
                      onChange={(e) => setEditingUser({...editingUser, level: e.target.value})}
                      className="w-full bg-black border border-white/5 rounded-2xl py-3 px-4 text-sm focus:border-orange-500 transition-colors"
                    >
                      {['LV1', 'LV2', 'LV3', 'LV4', 'LV5', 'LV6'].map(lv => (
                        <option key={lv} value={lv}>{lv}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Role</label>
                    <select 
                      disabled={stats.role === 'sub-admin'}
                      value={editingUser.role}
                      onChange={(e) => setEditingUser({...editingUser, role: e.target.value})}
                      className={`w-full bg-black border border-white/5 rounded-2xl py-3 px-4 text-sm focus:border-orange-500 transition-colors ${stats.role === 'sub-admin' ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                      <option value="sub-admin">Sub-Admin</option>
                    </select>
                    {stats.role === 'sub-admin' && <p className="text-[8px] text-red-500 font-bold uppercase tracking-widest mt-1">Only full admins can change roles</p>}
                  </div>
                </div>

                <div className="bg-zinc-900/50 p-6 rounded-2xl border border-white/5 space-y-6">
                  <h4 className="text-sm font-black uppercase tracking-widest text-orange-500">Mission Controls</h4>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Daily Mission Limit</label>
                    <input 
                      type="number"
                      value={editingUser.maxMissions || 25}
                      onChange={(e) => setEditingUser({...editingUser, maxMissions: e.target.value})}
                      className="w-full bg-black border border-white/5 rounded-2xl py-3 px-4 text-sm text-orange-500 font-bold focus:border-orange-500 transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Next Mission Cost ($)</label>
                      <input 
                        type="number"
                        step="0.01"
                        value={editingUser.nextMissionAmount || 0}
                        onChange={(e) => setEditingUser({...editingUser, nextMissionAmount: e.target.value})}
                        placeholder="0.00"
                        className="w-full bg-black border border-white/5 rounded-2xl py-3 px-4 text-sm text-emerald-500 font-bold focus:border-orange-500 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Next Mission Profit ($)</label>
                      <input 
                        type="number"
                        step="0.01"
                        value={editingUser.nextMissionProfit || 0}
                        onChange={(e) => setEditingUser({...editingUser, nextMissionProfit: e.target.value})}
                        placeholder="0.00"
                        className="w-full bg-black border border-white/5 rounded-2xl py-3 px-4 text-sm text-blue-500 font-bold focus:border-orange-500 transition-colors"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-zinc-500 italic">If Next Mission Cost/Profit is set, the user's next task will use these values instead of random ones.</p>
                </div>

                <div className="bg-zinc-900/50 p-6 rounded-2xl border border-white/5 space-y-6">
                  <h4 className="text-sm font-black uppercase tracking-widest text-orange-500">Task Approval Flow</h4>
                  
                  <div className="flex items-center justify-between p-4 bg-black/40 rounded-2xl border border-white/5">
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest">Task Approved</p>
                      <p className="text-[10px] text-zinc-500">Allow user to start missions</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingUser({...editingUser, taskApproved: !editingUser.taskApproved})}
                      className={`w-12 h-6 rounded-full transition-all duration-300 relative ${editingUser.taskApproved ? 'bg-emerald-500' : 'bg-zinc-700'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${editingUser.taskApproved ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-black/40 rounded-2xl border border-white/5">
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest">Task Reset</p>
                      <p className="text-[10px] text-zinc-500">{editingUser.hasCompletedTask ? 'User has completed a task' : 'User is ready for next task'}</p>
                    </div>
                    <button
                      type="button"
                      disabled={!editingUser.hasCompletedTask}
                      onClick={() => setEditingUser({...editingUser, hasCompletedTask: false, missionCount: 0})}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${editingUser.hasCompletedTask ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'}`}
                    >
                      Reset Task
                    </button>
                  </div>
                </div>

                <div className="bg-zinc-900/50 p-6 rounded-2xl border border-white/5 space-y-6">
                  <h4 className="text-sm font-black uppercase tracking-widest text-orange-500">Referral Management</h4>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Referral Code</label>
                    <div className="flex gap-2">
                      <input 
                        type="text"
                        value={editingUser.referralCode || ''}
                        onChange={(e) => setEditingUser({...editingUser, referralCode: e.target.value.toUpperCase()})}
                        placeholder="NO CODE SET"
                        className="flex-1 bg-black border border-white/5 rounded-2xl py-3 px-4 text-sm font-mono focus:border-orange-500 transition-colors"
                      />
                      <button 
                        type="button"
                        onClick={() => setEditingUser({...editingUser, referralCode: generateReferralCode()})}
                        className="px-4 bg-zinc-800 hover:bg-zinc-700 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-colors"
                      >
                        Generate
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-black/40 rounded-2xl border border-white/5">
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest">Referral Status</p>
                      <p className="text-[10px] text-zinc-500">Enable or disable this user's referral code</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingUser({...editingUser, referralEnabled: !editingUser.referralEnabled})}
                      className={`w-12 h-6 rounded-full transition-all duration-300 relative ${editingUser.referralEnabled ? 'bg-emerald-500' : 'bg-zinc-700'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${editingUser.referralEnabled ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Usage Limit</label>
                      <input 
                        type="number"
                        value={editingUser.referralLimit || 0}
                        onChange={(e) => setEditingUser({...editingUser, referralLimit: Number(e.target.value)})}
                        className="w-full bg-black border border-white/5 rounded-2xl py-3 px-4 text-sm text-orange-500 font-bold focus:border-orange-500 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Current Usage</label>
                      <div className="w-full bg-black/40 border border-white/5 rounded-2xl py-3 px-4 text-sm text-zinc-400 font-bold">
                        {editingUser.referralUsageCount || 0}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-white/5">
                  <h4 className="text-sm font-black text-orange-500 uppercase tracking-widest">Custom Missions (25 Tasks)</h4>
                  <div className="grid grid-cols-1 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {Array.from({ length: 25 }).map((_, index) => {
                      const mission = (editingUser.customMissions || [])[index] || { amount: 0, profit: 0 };
                      return (
                        <div key={index} className="bg-black/40 p-4 rounded-2xl border border-white/5 space-y-3">
                          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Mission {index + 1}</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[8px] text-zinc-600 uppercase font-bold">Amount ($)</label>
                              <input 
                                type="number"
                                step="0.01"
                                value={mission.amount}
                                onChange={(e) => {
                                  const newMissions = editingUser.customMissions ? [...editingUser.customMissions] : Array.from({ length: 25 }, () => ({ amount: 0, profit: 0 }));
                                  newMissions[index] = { ...mission, amount: Number(e.target.value) };
                                  setEditingUser({ ...editingUser, customMissions: newMissions });
                                }}
                                className="w-full bg-zinc-900 border border-white/5 rounded-xl py-2 px-3 text-xs focus:border-orange-500 transition-colors"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[8px] text-zinc-600 uppercase font-bold">Profit ($)</label>
                              <input 
                                type="number"
                                step="0.01"
                                value={mission.profit}
                                onChange={(e) => {
                                  const newMissions = editingUser.customMissions ? [...editingUser.customMissions] : Array.from({ length: 25 }, () => ({ amount: 0, profit: 0 }));
                                  newMissions[index] = { ...mission, profit: Number(e.target.value) };
                                  setEditingUser({ ...editingUser, customMissions: newMissions });
                                }}
                                className="w-full bg-zinc-900 border border-white/5 rounded-xl py-2 px-3 text-xs focus:border-orange-500 transition-colors"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-4 flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="flex-1 py-4 bg-zinc-900 hover:bg-zinc-800 rounded-2xl font-black transition-colors"
                  >
                    CANCEL
                  </button>
                  <button 
                    type="submit"
                    disabled={stats.role === 'sub-admin'}
                    className="flex-1 py-4 bg-orange-500 hover:bg-orange-400 rounded-2xl font-black transition-all shadow-[0_4px_20px_rgba(249,115,22,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {stats.role === 'sub-admin' ? 'RESTRICTED' : 'SAVE CHANGES'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
