"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

interface PaginationBarProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export function PaginationBar({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: PaginationBarProps) {
  if (totalItems === 0) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground py-2">
      {/* Items Range & Page Size */}
      <div className="flex items-center gap-3">
        <div>
          Showing <span className="font-semibold text-foreground">{startItem.toLocaleString()}</span> to{" "}
          <span className="font-semibold text-foreground">{endItem.toLocaleString()}</span> of{" "}
          <span className="font-semibold text-foreground">{totalItems.toLocaleString()}</span> leads
        </div>

        <div className="flex items-center gap-1.5 border-l pl-3">
          <span className="text-[11px]">Rows per page:</span>
          <Select
            value={String(pageSize)}
            onValueChange={(val) => {
              if (val) onPageSizeChange(parseInt(val, 10));
            }}
          >
            <SelectTrigger className="h-7 w-16 text-xs font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="25" className="text-xs">25</SelectItem>
              <SelectItem value="50" className="text-xs">50</SelectItem>
              <SelectItem value="100" className="text-xs">100</SelectItem>
              <SelectItem value="200" className="text-xs">200</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center gap-1">
        <span className="text-[11px] mr-2">
          Page <span className="font-semibold text-foreground">{currentPage}</span> of{" "}
          <span className="font-semibold text-foreground">{totalPages}</span>
        </span>

        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => onPageChange(1)}
          disabled={currentPage <= 1}
        >
          <ChevronsLeft className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </Button>

        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage >= totalPages}
        >
          <ChevronsRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
