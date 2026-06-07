import { Injectable, Logger } from '@nestjs/common';

export interface ParsedCommand {
  type: 'TASK' | 'EXPENSE' | 'DIARY' | 'ATTENDANCE' | 'JOURNEY' | 'PURCHASE' | 'AI_QUERY' | 'UNKNOWN';
  confidence: number;
  message: string;
  data: any;
}

@Injectable()
export class ParserService {
  private readonly logger = new Logger(ParserService.name);

  parseText(text: string): ParsedCommand {
    if (!text || text.trim().length === 0) {
      return {
        type: 'UNKNOWN',
        confidence: 0,
        message: 'No text provided',
        data: {},
      };
    }

    const cleanText = text.toLowerCase().trim();
    this.logger.log(`Parsing command: "${text}"`);

    // 1. Attendance Command Check
    // Examples: "in", "check in", "out", "check out", "leave", "wfh"
    const attendancePatterns = [
      { pattern: /\b(check\s*in|in|login|log\s*in)\b/i, status: 'IN', isWfh: false },
      { pattern: /\b(wfh\b|work\s*from\s*home)/i, status: 'IN', isWfh: true },
      { pattern: /\b(check\s*out|out|logout|log\s*out)\b/i, status: 'OUT', isWfh: false },
      { pattern: /\b(leave|holiday|sick\s*day)\b/i, status: 'LEAVE', isWfh: false },
    ];

    for (const item of attendancePatterns) {
      if (item.pattern.test(cleanText)) {
        return {
          type: 'ATTENDANCE',
          confidence: 0.9,
          message: `Parsed attendance request to check ${item.status.toLowerCase()}${item.isWfh ? ' (WFH)' : ''}`,
          data: {
            action: item.status, // IN, OUT, LEAVE
            isWfh: item.isWfh,
            status: item.status === 'LEAVE' ? 'LEAVE' : 'PRESENT',
          },
        };
      }
    }

    // 2. Expense Command Check
    // Examples: "spent 250 on lunch", "expense 120 tea", "250 rupees lunch"
    // Match money amounts: e.g. 250, 120, etc.
    const moneyPattern = /(?:spent|expense|spent\s*rs|rs|rupees|rupee|₹|amount)?\s*(\d+)\s*(?:on|for|spent)?\s*([a-zA-Z\s]+)?/i;
    const expenseKeywords = /\b(spent|expense|bought|spent|rupees|rs|rupee|₹|lunch|dinner|tea|coffee|food|fuel|travel)\b/i;

    if (expenseKeywords.test(cleanText)) {
      const match = cleanText.match(moneyPattern) || text.match(/(\d+)/);
      if (match) {
        const amount = parseInt(match[1], 10);
        let description = 'Uncategorized';
        
        // Extract description from match or surrounding text
        if (match[2]) {
          description = match[2].replace(/\b(rs|rupees|rupee|spent|on|for|expense)\b/g, '').trim();
        } else {
          // Fallback extraction
          description = cleanText.replace(/\b(\d+|spent|rs|rupees|rupee|on|for|expense)\b/g, '').trim();
        }
        
        if (!description) description = 'Miscellaneous';

        // Categorize description
        let category = 'Shopping';
        const descLower = description.toLowerCase();
        if (/\b(lunch|tea|coffee|dinner|food|breakfast|meals|eat|swiggy|zomato)\b/.test(descLower)) {
          category = 'Food';
        } else if (/\b(fuel|petrol|diesel|cng|travel|uber|ola|auto)\b/.test(descLower)) {
          category = 'Fuel';
        } else if (/\b(bill|electricity|wifi|mobile|recharge|rent|emi)\b/.test(descLower)) {
          category = 'Bills';
        } else if (/\b(medicine|doctor|clinic|pharmacy|hospital)\b/.test(descLower)) {
          category = 'Medical';
        }

        return {
          type: 'EXPENSE',
          confidence: 0.85,
          message: `Parsed expense of ₹${amount} for "${description}" (${category})`,
          data: {
            amount,
            description: description.charAt(0).toUpperCase() + description.slice(1),
            category,
          },
        };
      }
    }

    // 3. Task Command Check
    // Examples: "tomorrow verify pending PO", "task verify GRN", "verify GRN task", "task verify pending PO due tomorrow"
    const taskKeywords = /\b(task|todo|verify|check|process|audit|follow\s*up|remind|arrange|file|submit)\b/i;
    if (taskKeywords.test(cleanText)) {
      let title = cleanText
        .replace(/\b(task|todo|remind\s*me\s*to|remind\s*me|please|will|need\s*to)\b/g, '')
        .trim();
      
      // Determine due date
      let dueDate = new Date();
      let dueDateLabel = 'Today';

      if (/\b(tomorrow|tom)\b/.test(cleanText)) {
        dueDate.setDate(dueDate.getDate() + 1);
        dueDateLabel = 'Tomorrow';
        title = title.replace(/\b(tomorrow|tom)\b/g, '').trim();
      } else if (/\b(next\s*week)\b/.test(cleanText)) {
        dueDate.setDate(dueDate.getDate() + 7);
        dueDateLabel = 'Next Week';
        title = title.replace(/\b(next\s*week)\b/g, '').trim();
      }

      // Cleanup extra spaces
      title = title.replace(/\s+/g, ' ').trim();
      
      // Set priority
      let priority: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
      if (/\b(urgent|critical|high|asap)\b/.test(cleanText)) {
        priority = 'HIGH';
      } else if (/\b(low|whenever|easy)\b/.test(cleanText)) {
        priority = 'LOW';
      }

      // Extract tags
      const tags: string[] = ['Voice Input'];
      if (/\b(po|grn|stock|aisle)\b/.test(cleanText)) {
        tags.push('Store Ops');
      }

      return {
        type: 'TASK',
        confidence: 0.8,
        message: `Parsed task: "${title}" due ${dueDateLabel}`,
        data: {
          title: title.charAt(0).toUpperCase() + title.slice(1),
          dueDate: dueDate.toISOString(),
          priority,
          tags,
        },
      };
    }

    // 4. Diary Entry Command Check
    // Examples: "note completed stock verification", "note processed 15 GRNs"
    if (/\b(note|diary|completed|learnt|learned|issues|notes)\b/i.test(cleanText)) {
      let diaryText = cleanText
        .replace(/\b(note|diary|completed|write|add\s*to\s*diary|add\s*to\s*notes)\b/g, '')
        .trim();

      diaryText = diaryText.replace(/\s+/g, ' ').trim();

      return {
        type: 'DIARY',
        confidence: 0.75,
        message: `Parsed diary note: "${diaryText}"`,
        data: {
          whatIDid: diaryText.charAt(0).toUpperCase() + diaryText.slice(1),
        },
      };
    }

    // 5. Journey / Trip Command Check
    // Examples: "trip to ooty", "ooty trip budget 25000", "plan trip to ooty"
    const journeyKeywords = /\b(trip|journey|travel|vacation)\b/i;
    if (journeyKeywords.test(cleanText)) {
      const budgetMatch = cleanText.match(/\b(?:budget|cost|price)?\s*(?:rs|rupees|rupee|₹)?\s*(\d+)\b/i);
      const budget = budgetMatch ? parseInt(budgetMatch[1], 10) : 15000;

      let destination = cleanText
        .replace(/\b(trip|journey|travel|vacation|to|plan|budget|cost|price|rs|rupees|rupee|₹|\d+)\b/g, '')
        .trim();

      destination = destination.replace(/\s+/g, ' ').trim();
      if (!destination) destination = 'Munnar';

      destination = destination.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

      return {
        type: 'JOURNEY',
        confidence: 0.85,
        message: `Parsed trip to ${destination} with budget ₹${budget}`,
        data: {
          destination,
          budget,
        },
      };
    }

    // 6. Purchase Goal Command Check
    // Examples: "buy laptop", "purchase laptop", "save 50000 for scooter", "laptop goal 50000"
    const purchaseKeywords = /\b(buy|purchase|save|saving|goal)\b/i;
    if (purchaseKeywords.test(cleanText)) {
      const amountMatch = cleanText.match(/\b(?:save|saving|goal|for)?\s*(\d+)\b/i) || cleanText.match(/(\d+)/);
      const amount = amountMatch ? parseInt(amountMatch[1], 10) : 5000;

      let itemName = cleanText
        .replace(/\b(buy|purchase|save|saving|goal|for|to|rs|rupees|rupee|₹|\d+)\b/g, '')
        .trim();

      itemName = itemName.replace(/\s+/g, ' ').trim();
      if (!itemName) itemName = 'New Purchase';

      itemName = itemName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      const isLoggingSavings = /\b(save|saving)\b/i.test(cleanText);

      return {
        type: 'PURCHASE',
        confidence: 0.85,
        message: isLoggingSavings
          ? `Parsed savings log of ₹${amount} for "${itemName}"`
          : `Parsed purchase goal for "${itemName}" with target ₹${amount}`,
        data: {
          itemName,
          amount,
          isSavings: isLoggingSavings,
        },
      };
    }

    // 7. AI Query Command Check
    // Examples: "what is my balance", "how much spent on food", "am I checked in", "show pending tasks", "next holiday"
    const aiKeywords = /\b(what|how\s*much|am\s*i|show|pending|next\s*holiday|balance|salary\s*status|earned)\b/i;
    if (aiKeywords.test(cleanText)) {
      return {
        type: 'AI_QUERY',
        confidence: 0.9,
        message: `Parsed AI Assistant query: "${text}"`,
        data: {
          queryText: text,
        },
      };
    }

    // Default Fallback: Assume it's a general task or note if we can't classify
    return {
      type: 'TASK',
      confidence: 0.5,
      message: `Parsed as task (fallback): "${text}"`,
      data: {
        title: text.charAt(0).toUpperCase() + text.slice(1),
        dueDate: new Date().toISOString(),
        priority: 'MEDIUM',
        tags: ['Voice Fallback'],
      },
    };
  }
}
