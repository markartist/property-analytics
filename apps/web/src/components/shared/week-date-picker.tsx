"use client";

import React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

interface WeekDatePickerProps {
  value: Date | null;
  onChange: (date: Date) => void;
}

export function WeekDatePicker({ value, onChange }: WeekDatePickerProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="justify-start text-left font-normal border-yellow-300 bg-yellow-100 hover:bg-yellow-200 text-slate-900 font-medium"
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(value, "MMM d, yyyy") : "Select Date"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto border-slate-200 bg-white p-0 shadow-[0_20px_50px_rgba(15,23,42,0.18)]">
        <Calendar
          mode="single"
          selected={value ?? undefined}
          onSelect={(date) => {
            if (!date) return;
            onChange(date);
            setOpen(false);
          }}
          disabled={(date) => date.getDay() !== 5}
        />
      </PopoverContent>
    </Popover>
  );
}
