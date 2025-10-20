"use client";

import React, { useState } from "react";
import Link from "next/link";
import { User, Settings, LogOut, Crown, ChevronDown } from "lucide-react";

interface UserProfileProps {
  isExpanded: boolean;
}

export default function UserProfile({ isExpanded }: UserProfileProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Mock user data
  const user = {
    name: "사용자",
    email: "user@example.com",
    plan: "무료",
  };

  return (
    <div className="relative">
      {/* User Info Block */}
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className={`w-full flex items-center ${isExpanded ? 'gap-3' : 'justify-center'} p-3 hover:bg-neutral-100 rounded-xl transition-colors`}
      >
        <div className="w-10 h-10 bg-neutral-200 rounded-full flex items-center justify-center shrink-0">
          <User className="w-5 h-5 text-neutral-600" />
        </div>
        
        {isExpanded && (
          <>
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{user.name}</span>
                <span className="text-xs text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded">
                  {user.plan}
                </span>
              </div>
              <p className="text-xs text-neutral-500">{user.email}</p>
            </div>
            <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform ${
              isDropdownOpen ? "rotate-180" : ""
            }`} />
          </>
        )}
      </button>

      {/* Dropdown Menu */}
      {isDropdownOpen && isExpanded && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsDropdownOpen(false)}
          />
          
          {/* Menu */}
          <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-lg shadow-lg border border-neutral-200 z-50">
            {/* Menu Items */}
            <div className="py-2">
              <button className="w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-neutral-50 transition-colors">
                <Settings className="w-4 h-4 text-neutral-600" />
                <span>설정</span>
              </button>
              
              <button className="w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-neutral-50 transition-colors">
                <LogOut className="w-4 h-4 text-neutral-600" />
                <span>로그아웃</span>
              </button>
            </div>

            {/* Upgrade Button */}
            <div className="p-4 border-t border-neutral-100">
              <Link
                href="/pricing"
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-secondary transition-colors"
              >
                <Crown className="w-4 h-4" />
                <span className="font-medium">플랜 업그레이드</span>
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}