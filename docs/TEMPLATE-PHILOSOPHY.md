# SGE Template Philosophy & Approach

**Last Updated:** October 2, 2025  
**Status:** Phase 1 & 2 Complete

---

## 🎯 Core Philosophy: Infrastructure, Not Abstraction

This template is **NOT** a business logic framework. It's a **tech stack starter** with proven infrastructure patterns.

### What This Template IS ✅

**1. Infrastructure Foundation**
- Multi-tenant database with Row Level Security
- Authentication and invitation system
- Subscription management (Stripe integration)
- Multi-channel notifications (email, SMS, push)
- Role-based access control (6 tiers)

**2. Tech Stack Setup**
- React 18 + TypeScript + Vite (web)
- Capacitor 7 (iOS/Android mobile)
- Supabase (backend, database, auth, Edge Functions)
- Tailwind CSS + shadcn/ui (styling)
- Vercel-ready deployment

**3. Copy-and-Adapt Components**
- Production-quality UI components
- Clear TODO markers for customization
- Examples from ScheduleBoard v2
- You fork and modify for your needs

**4. Build Automation**
- iOS/Android version incrementing
- Mobile deployment scripts
- App Store compliance helpers
- CI/CD templates

**5. Optional Integration Modules**
- Stripe (if you need subscriptions)
- Resend (if you need email)
- Twilio (if you need SMS)
- Google Places (if you need location)

---

## What This Template is NOT ❌

**1. NOT Business Logic Abstraction**
```typescript
// ❌ We DON'T do this:
<JobsView businessType="hvac" /> // Too abstract
<ServiceBoard config={hvacConfig} /> // Too configurable

// ✅ We DO this:
// You get the infrastructure and examples
// You write your own JobsView for your domain
```

**2. NOT Configuration-Driven**
```typescript
// ❌ We DON'T do this:
enum BusinessType {
  HVAC = 'hvac',
  CLEANING = 'cleaning',
  MASSAGE = 'massage'
}

// Configuration hell with if/else everywhere
```

**3. NOT One-Size-Fits-All**
- Your business logic is unique
- Your workflow is custom
- Your UI/UX is specific to your users
- This template provides the foundation

**4. NOT A Framework**
- No lock-in or proprietary patterns
- You own all the code
- Customize everything
- Delete what you don't need

---

## 🏗️ What You Get vs What You Build

### You Get (From Template)

**Database Foundation:**
```sql
-- Multi-tenant infrastructure
✅ businesses table with subscription tiers
✅ profiles and user management
✅ user_business_roles (6-tier RBAC)
✅ business_invites (onboarding)
✅ subscription_events (Stripe webhooks)
✅ notifications system (4 tables)
✅ ~30 RLS policies for security
```

**Utilities & Helpers:**
```typescript
✅ dateUtils.ts - Timezone-safe date handling
✅ use-mobile.tsx - Responsive breakpoint detection
✅ mobileCompliance.ts - App Store policy helpers
✅ ProtectedRoute.tsx - Auth guards (with TODOs)
✅ utils.ts - Tailwind class utilities
```

**Build Automation:**
```bash
✅ npm run version:ios - Increment iOS build
✅ npm run version:android - Increment Android build
✅ Scripts work for any app name
```

**Edge Functions (Week 3):**
```
✅ create-invite, process-invite (onboarding)
✅ notification-orchestrator (multi-channel)
✅ stripe-webhooks (subscription sync)
✅ delete-user-account (GDPR compliance)
```

### You Build (Your Custom Logic)

**Your Domain Models:**
```sql
-- Examples of what YOU create:
CREATE TABLE your_jobs (...);       -- or appointments
CREATE TABLE your_services (...);   -- or products
CREATE TABLE your_clients (...);    -- or customers
CREATE TABLE your_inventory (...);  -- or equipment

-- You define:
- Your status enums
- Your workflow states
- Your business rules
- Your relationships
```

**Your Business Logic:**
```typescript
// You implement:
- Job/appointment creation and management
- Service scheduling algorithms
- Pricing calculations
- Workflow automation
- Reports and analytics
- Industry-specific features
```

**Your UI/UX:**
```tsx
// You customize:
- Dashboard layout for your users
- Forms for your data models
- Charts for your metrics
- Navigation for your workflows
- Branding and styling
```

---

## 💡 How to Use This Template

### Step 1: Generate Project

```bash
npx create-sge-app my-business-app

🚀 Project name: my-business-app
📱 Include mobile? Yes
💰 Add Stripe? Yes
📧 Add Resend? Yes
📲 Add SMS? No
📍 Add Google Places? No
```

**What gets created:**
- Core infrastructure (always)
- Mobile setup (if selected)
- Integration modules (based on selections)
- Environment template (based on integrations)
- Setup instructions (customized)

### Step 2: Understand the Foundation

**Review what you have:**
- `infra/schema/` - Database foundation
- `packages/shared/` - Utilities you can use
- `packages/ui/` - Component templates
- `packages/functions/` - Backend functions

**Read the docs:**
- Each package has a README
- Schema has detailed setup guide
- Components have clear TODO markers

### Step 3: Build Your Custom Logic

**Start with your data model:**
```sql
-- Add to infra/schema/custom.sql
CREATE TABLE my_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id),
  client_name text NOT NULL,
  scheduled_time timestamptz NOT NULL,
  status text NOT NULL,
  -- Your custom fields here
  created_at timestamptz DEFAULT now()
);

-- Don't forget RLS!
ALTER TABLE my_appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read appointments in their businesses"
ON my_appointments FOR SELECT TO authenticated
USING (
  business_id IN (SELECT business_id FROM get_user_business_ids())
);
```

**Build your UI:**
```typescript
// src/components/appointments/AppointmentsList.tsx
import { useIsMobile } from '@sge/shared/hooks/use-mobile';
import { cn } from '@sge/ui/lib/utils';
import { supabase } from '@/lib/supabase';

export function AppointmentsList() {
  const isMobile = useIsMobile();
  const [appointments, setAppointments] = useState([]);
  
  // Your custom logic here
  // Use the utilities we provided
  // Build on the foundation
}
```

### Step 4: Customize the Templates

**Update ProtectedRoute:**
```typescript
// packages/ui/auth/ProtectedRoute.tsx
// Find the TODO comments and replace with your auth

import { useAuth } from '@/context/AuthContext'; // Your implementation

const { user, loading } = useAuth(); // Replace the placeholders
```

**Customize email templates:**
```typescript
// packages/functions/auth/send-invite-email/index.ts
// Update the email HTML with your branding
// Change the domain to yours
// Customize the messaging
```

### Step 5: Deploy

```bash
# Build and deploy
npm run build
npm run deploy

# Mobile builds
npm run version:increment
npm run build:mobile
# Submit to app stores
```

---

## 🤔 When to Use This Template vs Start from Scratch

### Use This Template When:

✅ **Building a multi-tenant SaaS app**
- You need business isolation and RBAC
- You want subscription management
- You need user invitations and onboarding

✅ **Need mobile apps (iOS/Android)**
- You want Capacitor pre-configured
- You need build automation
- You want App Store compliance helpers

✅ **Want proven infrastructure patterns**
- Battle-tested from ScheduleBoard v2
- Security and RLS built-in
- Notification system included

✅ **Value rapid project setup**
- 5 minutes to running app
- Production database schema
- Integration modules ready

### Start from Scratch When:

❌ **Simple single-page app**
- No multi-tenancy needed
- No subscriptions needed
- No mobile apps needed

❌ **Extremely unique requirements**
- Custom database architecture
- Non-standard auth flows
- Completely different tech stack

❌ **Learning project**
- Want to understand every piece
- Building for education
- Prefer minimal starting point

---

## 🔍 Comparison to Other Approaches

### This Template vs Generic React Template

**create-react-app / Vite template:**
- ❌ No backend infrastructure
- ❌ No database schema
- ❌ No authentication
- ❌ No mobile support
- ❌ No deployment automation

**SGE Template:**
- ✅ Complete full-stack setup
- ✅ Multi-tenant database with security
- ✅ Auth and onboarding flows
- ✅ Mobile apps pre-configured
- ✅ Build and deployment automation

### This Template vs Business Logic Framework

**Hypothetical "ConfigurableBusinessApp":**
```typescript
// ❌ Too abstract, configuration hell
<BusinessApp 
  businessType="hvac"
  features={['scheduling', 'billing', 'inventory']}
  terminology={{ job: 'Service Call', customer: 'Client' }}
/>
```

**SGE Template:**
```typescript
// ✅ Infrastructure + your custom code
// You get: Multi-tenant DB, Auth, Subscriptions
// You build: Your specific JobsView with your logic
```

**Why This Is Better:**
- Less complexity (no abstraction layer)
- More flexibility (write your own logic)
- Easier to understand (concrete code, not config)
- Easier to maintain (no framework updates to chase)

---

## 📚 Real-World Usage Example

### Scenario: Building an HVAC Scheduling App

**What the template provides:**

1. **Infrastructure (Day 1)**
   ```bash
   npx create-sge-app my-hvac-app --mobile --stripe --resend
   # ✅ Multi-tenant database ready
   # ✅ User authentication working
   # ✅ iOS/Android projects created
   # ✅ Subscription system configured
   ```

2. **Foundation to build on:**
   - ✅ User can sign up / invite team members
   - ✅ Business isolation works
   - ✅ Role-based permissions work
   - ✅ Subscription tiers enforce limits
   - ✅ Mobile apps deploy to stores

**What you build (Week 1-2):**

1. **Your domain models:**
   ```sql
   CREATE TABLE service_calls (
     id uuid PRIMARY KEY,
     business_id uuid REFERENCES businesses(id),
     customer_id uuid REFERENCES customers(id),
     technician_id uuid REFERENCES profiles(id),
     scheduled_time timestamptz,
     status text, -- scheduled, in_progress, completed
     equipment_model text,
     issue_description text,
     -- Your HVAC-specific fields
   );
   
   CREATE TABLE equipment (
     id uuid PRIMARY KEY,
     business_id uuid REFERENCES businesses(id),
     -- Your equipment tracking
   );
   ```

2. **Your UI components:**
   ```tsx
   // src/components/ServiceCallBoard.tsx
   // Your custom scheduling interface
   // Built using the utilities we provided
   
   import { useIsMobile } from '@sge/shared/hooks/use-mobile';
   import { getTodayLocalString } from '@sge/shared/lib/dateUtils';
   
   // Your custom logic here
   ```

3. **Your business logic:**
   ```typescript
   // src/lib/scheduling.ts
   export function assignTechnician(serviceCall, technician) {
     // Your assignment algorithm
     // Your availability checking
     // Your optimization logic
   }
   ```

**Result:**
- Week 1: Running HVAC app with auth, mobile, subscriptions
- Week 2-3: Custom service call management complete
- Week 4: Deploy to production and app stores

**Without this template:**
- Week 1-2: Set up database, auth, multi-tenancy
- Week 3: Configure Capacitor, mobile builds
- Week 4: Add subscriptions and Stripe
- Week 5-6: Build your features
- Week 7: Finally deploy

**Savings: 4-5 weeks of infrastructure work**

---

## 🎓 Learning the Template

### Recommended Learning Path

**Day 1: Understand the Foundation**
1. Read `infra/schema/README.md` - Understand the database
2. Review `packages/shared/README.md` - See available utilities
3. Look at `packages/ui/README.md` - Component templates

**Day 2: Explore the Code**
1. Check `ProtectedRoute.tsx` - See auth pattern
2. Review `mobileCompliance.ts` - Understand App Store compliance
3. Look at RLS policies - Security implementation

**Day 3: Plan Your Customization**
1. Design your domain model (tables, relationships)
2. Plan your UI/UX
3. List your business logic requirements

**Day 4+: Start Building**
1. Add your custom schema
2. Build your UI components
3. Implement your business logic
4. Test and deploy

---

## ✅ Success Criteria

**You're using this template correctly if:**

✅ You understand what infrastructure is provided  
✅ You're building your own domain logic  
✅ You're customizing components for your needs  
✅ You're using the utilities where helpful  
✅ You're deleting what you don't need  

**You're misusing this template if:**

❌ You're trying to configure business types  
❌ You're looking for HVAC-specific features  
❌ You expect it to do everything for you  
❌ You're not writing any custom code  
❌ You're fighting against the structure  

---

## 🚀 Bottom Line

**This template gives you:**
- 2-3 weeks of infrastructure work done
- Production-ready patterns from ScheduleBoard v2
- Clear starting point for your custom logic
- Build automation and deployment helpers

**This template does NOT give you:**
- Your business logic
- Your industry-specific features
- Your workflow implementations
- A fully-configured app

**Think of it as:**
- 🏗️ The foundation of a house (provided)
- 🎨 The interior design (you build)
- 🛋️ The furniture (you choose)
- 🖼️ The decorations (you customize)

You get a solid foundation with working plumbing, electrical, and structure. You build the rest to match your vision.

---

**Template Version:** 1.0.0  
**Philosophy:** Infrastructure over abstraction, examples over configuration  
**Status:** Phase 1 & 2 Complete, ready for production use
