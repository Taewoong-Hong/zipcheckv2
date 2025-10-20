"use client";

import React, { useRef, useState, KeyboardEvent } from "react";
import { Send, Upload, Paperclip, Search, Loader2, X } from "lucide-react";

interface ChatInputProps {
  onSubmit: (message: string, files?: File[]) => void;
  isLoading: boolean;
  placeholder?: string;
}

export default function ChatInput({
  onSubmit,
  isLoading,
  placeholder = "부동산 계약과 관련된 무엇이든 물어보세요"
}: ChatInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    if (inputValue.trim() && !isLoading) {
      onSubmit(inputValue.trim(), attachedFiles.length > 0 ? attachedFiles : undefined);
      setInputValue("");
      setAttachedFiles([]);

      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setAttachedFiles(prev => [...prev, ...Array.from(files)]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);

    // Auto-resize textarea
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div>
      {/* Attached Files */}
      {attachedFiles.length > 0 && (
        <div className="px-4 pt-3 pb-2 border-b border-neutral-100">
          <div className="flex flex-wrap gap-2">
            {attachedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-2 px-3 py-1.5 bg-neutral-100 rounded-lg text-sm"
              >
                <Paperclip className="w-3.5 h-3.5 text-neutral-500" />
                <span className="text-neutral-700 max-w-[200px] truncate">
                  {file.name}
                </span>
                <span className="text-neutral-500 text-xs">
                  ({formatFileSize(file.size)})
                </span>
                <button
                  onClick={() => removeFile(index)}
                  className="ml-1 p-0.5 hover:bg-neutral-200 rounded transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-neutral-600" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="p-4">
        <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden focus-within:border-brand-primary transition-colors">
          <div className="flex items-center p-3 gap-2">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={isLoading}
              className="flex-1 bg-transparent outline-none text-neutral-800 placeholder-neutral-400 resize-none min-h-[24px] max-h-[200px]"
              rows={1}
            />

            {/* Action Buttons */}
            <div className="flex items-center gap-1">
              {/* Deep Search */}
              <button
                type="button"
                className="p-2 rounded-lg hover:bg-neutral-200 transition-colors group"
                title="딥 서치"
                disabled={isLoading}
              >
                <Search className="w-5 h-5 text-neutral-500 group-hover:text-brand-primary" />
              </button>

              {/* File Upload */}
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                multiple
                accept=".pdf,.doc,.docx,.hwp,.txt,.png,.jpg,.jpeg"
                className="hidden"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 rounded-lg hover:bg-neutral-200 transition-colors group"
                title="파일 업로드"
                disabled={isLoading}
              >
                <Upload className="w-5 h-5 text-neutral-500 group-hover:text-brand-primary" />
              </button>

              {/* Submit Button */}
              <button
                onClick={handleSubmit}
                disabled={!inputValue.trim() || isLoading}
                className="p-2 rounded-lg bg-brand-primary text-white hover:bg-brand-secondary transition-all disabled:opacity-50 disabled:cursor-not-allowed ml-1"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Helper Text */}
        <div className="mt-2 flex items-center justify-between px-1">
          <p className="text-xs text-neutral-400">
            Shift + Enter로 줄바꿈
          </p>
          {isLoading && (
            <p className="text-xs text-brand-primary animate-pulse">
              AI가 답변을 생성하고 있습니다...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}