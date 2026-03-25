import { 
  Home, 
  PlayCircle, 
  User, 
  Users, 
  FileText, 
  Download, 
  MessageSquare, 
  ShieldCheck, 
  TrendingUp, 
  HelpCircle, 
  Info,
  Wallet,
  Shield,
  CreditCard,
  History,
  Percent,
  LogOut
} from 'lucide-react';
import { NavItem, ActionButton, Song, MissionAsset } from './types';

export const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'start', label: 'Start', icon: PlayCircle },
  { id: 'me', label: 'Me', icon: User },
];

export const HOME_ACTIONS: ActionButton[] = [
  { label: 'Deposit', icon: Wallet, color: 'bg-zinc-800' },
  { label: 'Cert', icon: FileText, color: 'bg-zinc-800' },
  { label: 'Withdraw', icon: Download, color: 'bg-zinc-800' },
  { label: 'Customer Service', icon: MessageSquare, color: 'bg-zinc-800' },
  { label: 'T&C', icon: ShieldCheck, color: 'bg-zinc-800' },
  { label: 'Album Profit', icon: TrendingUp, color: 'bg-zinc-800' },
  { label: 'FAQ', icon: HelpCircle, color: 'bg-zinc-800' },
  { label: 'About Us', icon: Info, color: 'bg-zinc-800' },
];

export const SONGS: Song[] = [
  { id: 1, title: 'Better Days', artist: 'SoundHelix', duration: '06:12', cover: 'https://picsum.photos/seed/music1/200/200', audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { id: 2, title: 'Summer Walk', artist: 'SoundHelix', duration: '07:05', cover: 'https://picsum.photos/seed/summer/200/200', audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
  { id: 3, title: 'The Best Time', artist: 'SoundHelix', duration: '05:41', cover: 'https://picsum.photos/seed/best/200/200', audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
  { id: 4, title: 'Tropical Vibes', artist: 'SoundHelix', duration: '05:02', cover: 'https://picsum.photos/seed/tropical/200/200', audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3' },
  { id: 5, title: 'Chill Night', artist: 'SoundHelix', duration: '06:30', cover: 'https://picsum.photos/seed/night/200/200', audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3' },
  { id: 6, title: 'Dreamy Pop', artist: 'SoundHelix', duration: '07:15', cover: 'https://picsum.photos/seed/dreamy/200/200', audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3' },
  { id: 7, title: 'Upbeat Energy', artist: 'SoundHelix', duration: '05:55', cover: 'https://picsum.photos/seed/upbeat/200/200', audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3' },
  { id: 8, title: 'Acoustic Guitar', artist: 'SoundHelix', duration: '06:45', cover: 'https://picsum.photos/seed/acoustic/200/200', audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3' },
  { id: 9, title: 'Electronic Drive', artist: 'SoundHelix', duration: '07:20', cover: 'https://picsum.photos/seed/drive/200/200', audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3' },
  { id: 10, title: 'Soft Piano', artist: 'SoundHelix', duration: '08:10', cover: 'https://picsum.photos/seed/piano/200/200', audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3' },
  { id: 11, title: 'Midnight City', artist: 'SoundHelix', duration: '06:50', cover: 'https://picsum.photos/seed/city/200/200', audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3' },
  { id: 12, title: 'Morning Coffee', artist: 'SoundHelix', duration: '07:30', cover: 'https://picsum.photos/seed/coffee/200/200', audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3' },
  { id: 13, title: 'Sunset Boulevard', artist: 'SoundHelix', duration: '05:45', cover: 'https://picsum.photos/seed/sunset/200/200', audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-13.mp3' },
  { id: 14, title: 'Neon Lights', artist: 'SoundHelix', duration: '06:15', cover: 'https://picsum.photos/seed/neon/200/200', audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-14.mp3' },
  { id: 15, title: 'Ocean Waves', artist: 'SoundHelix', duration: '07:00', cover: 'https://picsum.photos/seed/ocean/200/200', audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-15.mp3' },
];

export const PROFILE_FUNCTIONS = [
  { label: 'Deposit', icon: Wallet },
  { label: 'Withdraw', icon: Download },
  { label: 'Team', icon: Users },
  { label: 'Security', icon: Shield },
  { label: 'Transactions', icon: History },
  { label: 'Commission', icon: Percent },
  { label: 'Logout', icon: LogOut },
];

export const MISSION_ASSETS: MissionAsset[] = [
  { id: '1', name: 'When You\'re', image: 'https://picsum.photos/seed/music1/300/300', amount: 32, profit: 0.64 },
  { id: '2', name: 'Midnight Sky', image: 'https://picsum.photos/seed/music2/300/300', amount: 45, profit: 0.90 },
  { id: '3', name: 'Golden Hour', image: 'https://picsum.photos/seed/music3/300/300', amount: 28, profit: 0.56 },
  { id: '4', name: 'Ocean Eyes', image: 'https://picsum.photos/seed/music4/300/300', amount: 50, profit: 1.00 },
  { id: '5', name: 'Blinding Lights', image: 'https://picsum.photos/seed/music5/300/300', amount: 38, profit: 0.76 },
];

export const RATING_OPTIONS = [
  { id: 'A', stars: 5, text: 'The real meaning of this music is to make people happy, inspiring, and powerful. It is really a great work.' },
  { id: 'B', stars: 4, text: 'Good melody and rhythm, with a strong sense of substitution. It is worth recommending to family and friends.' },
  { id: 'C', stars: 3, text: 'This music is beautiful and meaningful.' },
  { id: 'D', stars: 2, text: 'The melody and rhythm of the music are pretty good.' },
  { id: 'E', stars: 1, text: 'Good, but not good enough to impressme.' },
];
