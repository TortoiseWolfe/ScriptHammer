'use client';

import React, { ReactNode } from 'react';

export interface TooltipProps {
  children: ReactNode;
  text: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  children,
  text,
  position = 'top',
  className = '',
}) => {
  const positionClasses = {
    top: 'tooltip-top',
    bottom: 'tooltip-bottom',
    left: 'tooltip-left',
    right: 'tooltip-right',
  };

  return (
    <div
      className={`tooltip ${positionClasses[position]} ${className}`}
      data-tip={text}
    >
      {children}
    </div>
  );
};

// Common acronym definitions for reuse
export const acronyms = {
  PWA: 'Progressive Web App - An app that works offline and can be installed like a native app',
  API: 'Application Programming Interface - A way for programs to communicate with each other',
  CSS: 'Cascading Style Sheets - Used for styling web pages',
  HTML: 'HyperText Markup Language - The standard markup language for web pages',
  JS: 'JavaScript - A programming language for web development',
  TS: 'TypeScript - A typed superset of JavaScript',
  UI: 'User Interface - The visual elements users interact with',
  UX: 'User Experience - How users interact with and experience a product',
  SEO: 'Search Engine Optimization - Improving visibility in search results',
  URL: 'Uniform Resource Locator - The address of a web page',
  JSON: 'JavaScript Object Notation - A data format for storing and transporting data',
  XML: 'eXtensible Markup Language - A markup language for storing and transporting data',
  HTTP: 'HyperText Transfer Protocol - The protocol for transmitting web pages',
  HTTPS: 'HyperText Transfer Protocol Secure - Encrypted HTTP',
  REST: 'Representational State Transfer - An architectural style for APIs',
  CRUD: 'Create, Read, Update, Delete - Basic database operations',
  CI: 'Continuous Integration - Automatically testing code changes',
  CD: 'Continuous Deployment - Automatically deploying code changes',
  CLI: 'Command Line Interface - Text-based user interface',
  GUI: 'Graphical User Interface - Visual interface with windows and icons',
  IDE: 'Integrated Development Environment - Software for writing code',
  SDK: 'Software Development Kit - Tools for building software',
  SPA: 'Single Page Application - Web app that loads a single page',
  SSR: 'Server-Side Rendering - Generating HTML on the server',
  SSG: 'Static Site Generation - Pre-building pages at build time',
  ISR: 'Incremental Static Regeneration - Updating static pages after build',
  CDN: 'Content Delivery Network - Distributed servers for faster content delivery',
  DNS: 'Domain Name System - Translates domain names to IP addresses',
  IP: 'Internet Protocol - Address system for devices on a network',
  TCP: 'Transmission Control Protocol - Reliable data transmission protocol',
  UDP: 'User Datagram Protocol - Fast but unreliable data transmission',
  SQL: 'Structured Query Language - Language for managing databases',
  NoSQL: 'Not Only SQL - Non-relational database systems',
  ORM: 'Object-Relational Mapping - Converting between database and objects',
  MVC: 'Model-View-Controller - Software design pattern',
  MVP: 'Minimum Viable Product - Product with just enough features',
  POC: 'Proof of Concept - Demonstration of feasibility',
  QA: 'Quality Assurance - Ensuring product quality',
  A11y: 'Accessibility - Making apps usable for people with disabilities',
  I18n: 'Internationalization - Preparing apps for multiple languages',
  L10n: 'Localization - Adapting apps for specific regions',
  DRY: "Don't Repeat Yourself - Avoiding code duplication",
  SOLID:
    'Single responsibility, Open-closed, Liskov substitution, Interface segregation, Dependency inversion - Design principles',
  KISS: 'Keep It Simple, Stupid - Favoring simplicity in design',
  YAGNI: "You Aren't Gonna Need It - Avoid adding unnecessary features",
  TDD: 'Test-Driven Development - Writing tests before code',
  BDD: 'Behavior-Driven Development - Development based on expected behavior',
  DDD: 'Domain-Driven Design - Design based on the business domain',
  IoT: 'Internet of Things - Network of connected physical devices',
  AI: 'Artificial Intelligence - Machines simulating human intelligence',
  ML: 'Machine Learning - Computers learning from data',
  NLP: 'Natural Language Processing - Computers understanding human language',
  CV: 'Computer Vision - Computers understanding visual information',
  AR: 'Augmented Reality - Digital content overlaid on the real world',
  VR: 'Virtual Reality - Immersive digital environments',
  XR: 'Extended Reality - Umbrella term for AR, VR, and mixed reality',
  GPU: 'Graphics Processing Unit - Processor for graphics and parallel computing',
  CPU: 'Central Processing Unit - Main processor of a computer',
  RAM: 'Random Access Memory - Temporary storage for running programs',
  ROM: 'Read-Only Memory - Permanent storage that cannot be modified',
  SSD: 'Solid State Drive - Fast storage without moving parts',
  HDD: 'Hard Disk Drive - Traditional storage with spinning disks',
  OS: 'Operating System - Software that manages computer hardware',
  VM: 'Virtual Machine - Emulated computer system',
  VPN: 'Virtual Private Network - Secure connection over the internet',
  SSH: 'Secure Shell - Protocol for secure remote access',
  FTP: 'File Transfer Protocol - Protocol for transferring files',
  SMTP: 'Simple Mail Transfer Protocol - Protocol for sending email',
  POP3: 'Post Office Protocol version 3 - Protocol for receiving email',
  IMAP: 'Internet Message Access Protocol - Protocol for accessing email',
  OAuth: 'Open Authorization - Standard for access delegation',
  JWT: 'JSON Web Token - Compact way to transmit information securely',
  CORS: 'Cross-Origin Resource Sharing - Mechanism for cross-domain requests',
  XSS: 'Cross-Site Scripting - Security vulnerability in web apps',
  CSRF: 'Cross-Site Request Forgery - Attack that tricks users into unwanted actions',
  DDoS: 'Distributed Denial of Service - Attack that overwhelms a server',
  WAF: 'Web Application Firewall - Security layer for web apps',
  RBAC: 'Role-Based Access Control - Access based on user roles',
  MFA: '2FA/Multi-Factor Authentication - Multiple verification methods',
  TOTP: 'Time-based One-Time Password - Temporary authentication code',
  SAML: 'Security Assertion Markup Language - Standard for authentication',
  LDAP: 'Lightweight Directory Access Protocol - Protocol for accessing directories',
  GDPR: 'General Data Protection Regulation - EU data protection law',
  PII: 'Personally Identifiable Information - Data that identifies individuals',
  SLA: 'Service Level Agreement - Contract defining service standards',
  KPI: 'Key Performance Indicator - Metric for measuring performance',
  ROI: 'Return on Investment - Measure of investment profitability',
  B2B: 'Business to Business - Commerce between businesses',
  B2C: 'Business to Consumer - Commerce with end consumers',
  CRM: 'Customer Relationship Management - Managing customer interactions',
  ERP: 'Enterprise Resource Planning - Managing business processes',
  CMS: 'Content Management System - Software for managing content',
  LMS: 'Learning Management System - Software for educational courses',
  PIM: 'Product Information Management - Managing product data',
  DAM: 'Digital Asset Management - Managing digital assets',
  SCM: 'Source Code Management - Version control for code',
  VCS: 'Version Control System - System for tracking changes',
  PR: 'Pull Request - Proposal to merge code changes',
  MR: 'Merge Request - Same as Pull Request',
  SHA: 'Secure Hash Algorithm - Cryptographic hash function',
  MD5: 'Message Digest 5 - Cryptographic hash function',
  AES: 'Advanced Encryption Standard - Encryption algorithm',
  RSA: 'Rivest-Shamir-Adleman - Public-key encryption algorithm',
  TLS: 'Transport Layer Security - Protocol for secure communication',
  SSL: 'Secure Sockets Layer - Predecessor to TLS',
  CA: 'Certificate Authority - Issues digital certificates',
  CSR: 'Certificate Signing Request - Request for a digital certificate',
  PEM: 'Privacy Enhanced Mail - File format for certificates',
  DER: 'Distinguished Encoding Rules - Binary format for certificates',
  YAML: "YAML Ain't Markup Language - Human-readable data format",
  TOML: "Tom's Obvious, Minimal Language - Configuration file format",
  CSV: 'Comma-Separated Values - Simple data format',
  TSV: 'Tab-Separated Values - Data format using tabs',
  PDF: 'Portable Document Format - Document file format',
  SVG: 'Scalable Vector Graphics - XML-based vector image format',
  PNG: 'Portable Network Graphics - Lossless image format',
  JPG: 'JPEG - Joint Photographic Experts Group - Lossy image format',
  GIF: 'Graphics Interchange Format - Animated image format',
  WebP: 'Web Picture - Modern image format by Google',
  AVIF: 'AV1 Image File Format - Efficient image format',
  MP4: 'MPEG-4 Part 14 - Video container format',
  WebM: 'Web Media - Open video format',
  OGG: 'Ogg - Open container format',
  FLAC: 'Free Lossless Audio Codec - Lossless audio format',
  MP3: 'MPEG-1 Audio Layer 3 - Lossy audio format',
  AAC: 'Advanced Audio Coding - Audio compression format',
  OPUS: 'Opus - Open audio codec',
  WOFF: 'Web Open Font Format - Font format for the web',
  TTF: 'TrueType Font - Font file format',
  OTF: 'OpenType Font - Font file format',
  EOT: 'Embedded OpenType - Font format for Internet Explorer',
  UTF: 'Unicode Transformation Format - Character encoding',
  ASCII:
    'American Standard Code for Information Interchange - Character encoding',
  RGB: 'Red Green Blue - Color model',
  HSL: 'Hue Saturation Lightness - Color model',
  HEX: 'Hexadecimal - Base-16 number system for colors',
  CMYK: 'Cyan Magenta Yellow Black - Color model for printing',
  DPI: 'Dots Per Inch - Measure of print/screen resolution',
  PPI: 'Pixels Per Inch - Measure of pixel density',
  FPS: 'Frames Per Second - Measure of video/animation speed',
  Kbps: 'Kilobits per second - Data transfer rate',
  Mbps: 'Megabits per second - Data transfer rate',
  Gbps: 'Gigabits per second - Data transfer rate',
  KB: 'Kilobyte - 1024 bytes',
  MB: 'Megabyte - 1024 kilobytes',
  GB: 'Gigabyte - 1024 megabytes',
  TB: 'Terabyte - 1024 gigabytes',
  PB: 'Petabyte - 1024 terabytes',
  EB: 'Exabyte - 1024 petabytes',
};

// Helper component for common acronyms
export interface AcronymProps {
  children: string;
  className?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export const Acronym: React.FC<AcronymProps> = ({
  children,
  className = 'underline decoration-dotted cursor-help',
  position = 'top',
}) => {
  const definition = acronyms[children as keyof typeof acronyms];

  if (!definition) {
    return <span className={className}>{children}</span>;
  }

  return (
    <Tooltip text={definition} position={position} className="inline">
      <span className={className}>{children}</span>
    </Tooltip>
  );
};
