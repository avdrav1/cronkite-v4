import { z } from 'zod';

// Contact validation schema
const contactSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional()
});

export type Contact = z.infer<typeof contactSchema>;

interface ParsedContact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
}

/**
 * Parse contact file and extract contact information
 * Supports CSV, VCF (vCard), and TXT formats
 */
export async function parseContactFile(file: any): Promise<ParsedContact[]> {
  const fileContent = file.data ? file.data.toString('utf8') : file.buffer?.toString('utf8');
  
  if (!fileContent) {
    throw new Error('File content is empty or invalid');
  }

  const fileName = file.name || file.originalname || '';
  const fileExtension = fileName.split('.').pop()?.toLowerCase();

  switch (fileExtension) {
    case 'csv':
      return parseCSV(fileContent);
    case 'vcf':
      return parseVCF(fileContent);
    case 'txt':
      return parseTXT(fileContent);
    default:
      throw new Error(`Unsupported file format: ${fileExtension}`);
  }
}

/**
 * Parse CSV format
 * Expected formats:
 * - name,email,phone
 * - "First Last",email@example.com,+1234567890
 */
function parseCSV(content: string): ParsedContact[] {
  const lines = content.split('\n').map(line => line.trim()).filter(line => line);
  const contacts: ParsedContact[] = [];
  
  // Skip header if it looks like one
  const startIndex = lines[0]?.toLowerCase().includes('name') || 
                    lines[0]?.toLowerCase().includes('email') ? 1 : 0;

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    const fields = parseCSVLine(line);
    
    if (fields.length >= 1) {
      const name = fields[0]?.trim();
      const email = fields[1]?.trim();
      const phone = fields[2]?.trim();
      
      if (name) {
        contacts.push({
          id: generateContactId(name, email),
          name,
          email: isValidEmail(email) ? email : undefined,
          phone: isValidPhone(phone) ? phone : undefined
        });
      }
    }
  }

  return contacts;
}

/**
 * Parse VCF (vCard) format
 */
function parseVCF(content: string): ParsedContact[] {
  const contacts: ParsedContact[] = [];
  const vcards = content.split('BEGIN:VCARD');
  
  for (const vcard of vcards) {
    if (!vcard.includes('END:VCARD')) continue;
    
    const lines = vcard.split('\n').map(line => line.trim());
    let name = '';
    let email = '';
    let phone = '';
    
    for (const line of lines) {
      if (line.startsWith('FN:')) {
        name = line.substring(3).trim();
      } else if (line.startsWith('N:')) {
        // N:Last;First;Middle;Prefix;Suffix
        const nameParts = line.substring(2).split(';');
        if (!name && nameParts.length >= 2) {
          name = `${nameParts[1]} ${nameParts[0]}`.trim();
        }
      } else if (line.startsWith('EMAIL')) {
        // EMAIL:email@example.com or EMAIL;TYPE=HOME:email@example.com
        const emailMatch = line.match(/EMAIL[^:]*:(.+)/);
        if (emailMatch) {
          email = emailMatch[1].trim();
        }
      } else if (line.startsWith('TEL')) {
        // TEL:+1234567890 or TEL;TYPE=CELL:+1234567890
        const phoneMatch = line.match(/TEL[^:]*:(.+)/);
        if (phoneMatch) {
          phone = phoneMatch[1].trim();
        }
      }
    }
    
    if (name) {
      contacts.push({
        id: generateContactId(name, email),
        name,
        email: isValidEmail(email) ? email : undefined,
        phone: isValidPhone(phone) ? phone : undefined
      });
    }
  }
  
  return contacts;
}

/**
 * Parse TXT format
 * Expected formats:
 * - One contact per line: "Name <email@example.com>"
 * - Simple format: "Name email@example.com"
 * - Name only: "Name"
 */
function parseTXT(content: string): ParsedContact[] {
  const lines = content.split('\n').map(line => line.trim()).filter(line => line);
  const contacts: ParsedContact[] = [];
  
  for (const line of lines) {
    // Format: "Name <email@example.com>"
    const emailInBracketsMatch = line.match(/^(.+?)\s*<([^>]+)>$/);
    if (emailInBracketsMatch) {
      const name = emailInBracketsMatch[1].trim();
      const email = emailInBracketsMatch[2].trim();
      
      contacts.push({
        id: generateContactId(name, email),
        name,
        email: isValidEmail(email) ? email : undefined
      });
      continue;
    }
    
    // Format: "Name email@example.com" or "Name email@example.com phone"
    const parts = line.split(/\s+/);
    if (parts.length >= 2) {
      const possibleEmail = parts[parts.length - 1];
      const possiblePhone = parts.length >= 3 ? parts[parts.length - 2] : '';
      
      if (isValidEmail(possibleEmail)) {
        const name = parts.slice(0, -1).join(' ');
        contacts.push({
          id: generateContactId(name, possibleEmail),
          name,
          email: possibleEmail,
          phone: isValidPhone(possiblePhone) ? possiblePhone : undefined
        });
        continue;
      }
    }
    
    // Format: Just name
    if (line.length > 0) {
      contacts.push({
        id: generateContactId(line, ''),
        name: line
      });
    }
  }
  
  return contacts;
}

/**
 * Parse a CSV line handling quoted fields
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  fields.push(current);
  return fields;
}

/**
 * Validate email format
 */
function isValidEmail(email?: string): boolean {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone format (basic validation)
 */
function isValidPhone(phone?: string): boolean {
  if (!phone) return false;
  // Remove common phone formatting characters
  const cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
  // Check if it's mostly digits and reasonable length
  return /^\d{7,15}$/.test(cleaned);
}

/**
 * Generate a unique contact ID
 */
function generateContactId(name: string, email?: string): string {
  const base = email || name;
  return Buffer.from(base.toLowerCase()).toString('base64').substring(0, 12);
}