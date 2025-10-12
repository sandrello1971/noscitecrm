interface VCardContact {
  firstName?: string;
  lastName?: string;
  company?: string;
  position?: string;
  email?: string;
  phone?: string;
  mobile?: string;
}

export const generateVCard = (contact: VCardContact): string => {
  const vcard = [
    'BEGIN:VCARD',
    'VERSION:3.0',
  ];

  // Name
  const fn = `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
  if (fn) {
    vcard.push(`FN:${fn}`);
    vcard.push(`N:${contact.lastName || ''};${contact.firstName || ''};;;`);
  }

  // Organization and Title
  if (contact.company) {
    vcard.push(`ORG:${contact.company}`);
  }
  if (contact.position) {
    vcard.push(`TITLE:${contact.position}`);
  }

  // Email
  if (contact.email) {
    vcard.push(`EMAIL;TYPE=WORK:${contact.email}`);
  }

  // Phone numbers
  if (contact.phone) {
    vcard.push(`TEL;TYPE=WORK,VOICE:${contact.phone}`);
  }
  if (contact.mobile) {
    vcard.push(`TEL;TYPE=CELL:${contact.mobile}`);
  }

  vcard.push('END:VCARD');

  return vcard.join('\r\n');
};

export const downloadVCard = (vCardContent: string, fileName: string): void => {
  const blob = new Blob([vCardContent], { type: 'text/vcard;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileName}.vcf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
