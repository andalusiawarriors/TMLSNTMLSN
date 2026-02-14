# TMLSN

## Project Description
TMLSN  APP



TMLSN App Notes — Structured + Cohesive
1) Core role
* The app is a lead magnet.
* It converts attention → retained users → paid ecosystem.

2) Product thesis
Apps used to be single-purpose tools.Apps are becoming “hosts”: one place that bundles many functions and connects them.
* Now: apps = separate tools (calorie tracker, workout tracker, timer, notes)
* Next: apps = platforms that contain tools + content + coaching + automation
* TMLSN’s direction: start with tools, evolve into an integrated system

3) What the app contains (layers)
Layer A — Tools (free entry)
* Calorie / nutrition tracker
* Workout tracker
* Timers / habit utilities (where relevant)
* Prompt vault (see Layer B)
Layer B — “How-to” + prompts (proof-of-implementation)
* Rule: Any actionable advice we publish must be backed by a usable prompt.
* The app becomes the execution engine for posts:
    * Post explains what to do
    * App provides the prompt that makes it easy
    * User saves, runs, and reuses prompts inside their workflow
Layer C — Notifications (retention + behavior + distribution)
* The app must include features that require notifications (notifications = retention).
* Notifications aren’t “reminders.” They are coaching triggers:
    * habit prompts
    * check-ins
    * “do it now” scripts
    * execution nudges tied to the user’s plan
* The app is also a direct distribution channel:
    * notification when we post a newsletter
    * notification when we upload a YouTube video
Layer D — Content + community feed
* A feed that can host:
    * our content (how-to, protocols, updates)
    * community content (Skool-like dynamics inside the app later if needed)
    * paid-only streams
Layer E — Coaching (endgame)
* “Have us as coaches digitally (AI).”
* The AI becomes the interface to the system:
    * planner
    * recommender
    * constraint-aware coach
    * integrator of data + prompts + tools

4) The initial build (MVP)
Initial plan (VibeCode build):
1. Calorie app
2. Workout tracker
3. Prompt vault: storage of AI prompts users can use to apply actionable advice from our posts
4. Mastering Aesthetics course inside the app (or linked + integrated)
Goal: ship something useful fast that naturally connects to the content strategy.

5) Monetization model (Free → Paid)
Free version = separate tools
* Users get standalone utilities:
    * tracker(s)
    * prompt vault
    * basic reminders
    * content-drop notifications (newsletter/YouTube)
* Value: useful immediately + habit formation inside the ecosystem.
Paid version = access to aesthetics mastery.
later on but not part of mvp: integrated system + AI coach
Paid unlocks:
* All tools connecting to each other (not just the initial two)
* User history + data becomes usable (trends, adherence, patterns)
* AI can access the connected system and guide the user based on:
    * goals
    * constraints
    * time
    * resources
    * context and progress
* Outcome: a “biohacking / self-development AI” that organizes everything optimally.

6) Packaging logic (what the AI can coach on)
* Users pay for the whole package: the 4 Pillars, so the AI can interact freely across the full life system.
* If someone only buys Mastering Aesthetics, then:
    * the AI is restricted to that pillar
    * it doesn’t advise across the full operating system
This keeps pricing clean and creates a clear upsell path.

7) Adjacent retention hooks (supporting surfaces)
Optional “sticky” integrations:
* Phone wallpaper (identity + reminders)
* iPhone shortcuts (quick-launch prompts, logging, check-ins)

8) One-line definition
TMLSN starts as useful tools, then becomes an integrated operating system—where an AI version of us coaches the user using their real data, constraints, and prompt-backed action plans, while also notifying them when new newsletter and YouTube content drops.

9) Name
* App name: TMLSN

we just want the mvp for now


## Product Requirements Document
PRODUCT REQUIREMENTS DOCUMENT (PRD) - TMLSN App (MVP)

1. Introduction and Goals

1.1. Project Name
TMLSN App

1.2. Document Version
1.0 (MVP Specification)

1.3. Goals

The TMLSN app serves as a lead magnet, designed to convert initial attention into retained users, and subsequently, into paying subscribers within our ecosystem.

Core MVP Goal: Ship a useful, interconnected set of tools fast that naturally connects to our broader content strategy (newsletter/YouTube) and provides a clear upgrade path to our premium offerings.

1.4. Target Audience (MVP Focus)
Ambitious university-aged males (18-24) who are technologically proficient, focused on self-improvement (financial success tied to physical appearance/confidence), but currently lack the structure to consistently adhere to nutrition and workout protocols. Pain points include insecurity, lack of muscle, and low confidence due to routine failure.

1.5. One-Line Definition
TMLSN starts as useful tools (nutrition, workout tracking, prompt vault), then becomes an integrated operating system—where an AI version of us coaches the user using their real data, constraints, and prompt-backed action plans, while also notifying them when new newsletter and YouTube content drops.

2. Product Vision and Thesis

2.1. Product Thesis
The application is evolving from a single-purpose tool into a "host" platform. The MVP focuses on establishing the foundational tools (Layer A) and the mechanism for converting external content into internal execution (Layer B), providing immediate utility to drive habit formation within our ecosystem.

2.2. Evolution Layers (Context)
Layer A: Tools (MVP Focus)
Layer B: Actionable Prompts (MVP Focus)
Layer C: Distribution/Retention Notifications (MVP Focus: Distribution Only)
Layer D: Content/Community Feed (Future Scope)
Layer E: Coaching/AI Integration (Future Scope)

3. MVP Scope (V1.0 Features)

The initial build will focus on four core components: Calorie/Nutrition Tracker, Workout Tracker, Prompt Vault, and integration of the Mastering Aesthetics course structure.

3.1. Layer A: Tools (MVP)

3.1.1. Calorie/Nutrition Tracker (Detailed Requirements)
*   Functionality: Track Calories, Protein (P), Carbohydrates (C), and Fats (F).
*   Micronutrients: Must include tracking sections for key electrolytes: Magnesium, Calcium, Sodium, and Potassium.
*   Meal Structure: Support separate logging sections for Breakfast, Lunch, Dinner, and Snacks. Meal timing is secondary to categorization.
*   Water Intake: Dedicated tracking section for water intake (volume).
*   Database: Must integrate with established, reliable food databases for accurate lookups.
*   Units: Support for Metric (grams, kg, ml) and US customary (oz, lbs, cups, tsp, tbsp).
*   AI Integration (Future/Post-MVP): Ability to log food entry via a simple picture upload, utilizing an external AI API for data extraction/estimation. (MVP will focus on manual/database entry).

3.1.2. Workout Tracker (Detailed Requirements)
*   Logging Fields: Exercise Name, Sets, Reps, Weight.
*   Rest Timer: Custom toggle activation. If activated, a countdown timer must run. The system must provide a recommended default timer duration based on the exercise type (for TMLSN Split workouts or free form). Users receive a notification when the rest countdown is complete.
*   Pre-loaded Workouts: Must include at least one complete, runnable workout plan called the "TMLSN SPLIT."
*   Free-Form Logging: Users must be able to log any exercise not included in the pre-loaded splits.
*   Progressive Overload: The app must store and display historical data (sets/reps/weight) for each exercise to facilitate progressive overload tracking.

3.2. Layer B: Prompt Vault (MVP)

*   Mechanism: Text storage interface. Each entry displays the actionable prompt text in a copyable box.
*   Attribution: Above the prompt text box, a link/reference must be clearly displayed linking back to the original newsletter article/post where the advice originated.
*   Usage: Users can click to copy the entire prompt text to their clipboard for external use (e.g., pasting into an AI interface).
*   Content Cadence: The database structure must support weekly uploads of new prompts derived from published content.
*   User History: Track which prompts the user has saved or utilized.

3.3. Layer C: Notifications (MVP)

*   Scope Restriction: MVP notifications are strictly limited to **Distribution Channels**.
*   Distribution Triggers: Notify users upon release of a new official Newsletter and/or YouTube video upload.
*   Behavioral/Coaching Notifications (Future Scope/Not in MVP).

3.4. Layer D: Content (MVP)

*   Mastering Aesthetics Course: The paid "Mastering Aesthetics" course content must reside within the app database or be seamlessly integrated via a deep link that maintains session context.

4. Data Persistence and Schema Requirements

Data must be structured to support siloed use in the Free tier and integrated querying in the Paid tier. Data continuity upon upgrade is mandatory.

4.1. Tool Data (Layer A - Foundation)
*   Calorie/Nutrition Logs: Date, Amount (grams/volume), Meal Category (B/L/D/S), P/C/F values, Electrolyte entries (Mg, Ca, Na, K), Water Volume.
*   Workout Logs: Date, Exercise Name, Sets, Reps, Weight, Rest Duration (if logged), Associated TMLSN Split ID (if applicable).
*   Prompt Vault: Prompt Text, Source Link/Post ID, Timestamp saved/used.

4.2. Content-to-Execution Links (Layer B)
*   Mapping: Association table linking User ID, Post ID, and Prompt ID.
*   Execution History: Timestamp and context of prompt usage.

4.3. User Profile & Context (Foundation)
*   Basics: Height, Current Weight, Goal Weight.
*   Subscription Status: Current tier level (Free/Paid Pillar 1/Paid Full System).

4.4. Data Integration Requirement (Free vs. Paid Distinction)
*   Free Version: Data remains in isolated components (e.g., calorie data does not inform workout suggestions, as no coaching exists).
*   Paid Transition: Upon upgrade, the system must enable querying across all logged data to derive aggregated insights (trends, adherence patterns) required for future AI coaching functionality.

5. Monetization and Packaging Logic

5.1. Free Tier (Lead Magnet)
Provides access to standalone, useful utilities: Calorie Tracker (basic logging), Workout Tracker (basic logging), Prompt Vault (access to prompts + source links), and content drop notifications. Value proposition is immediate utility and habit formation.

5.2. Paid Tiers (Subscription Required)

**Option 1 (Pillar Specific - Aesthetics Mastery):**
*   Price Point: $9.99/month or $79.99/year.
*   Unlocks: Access to the Mastering Aesthetics course content + full data persistence/reporting for *all* tools (including connected history) + AI coach restricted *only* to the Aesthetics Pillar (based on available data).

**Option 2 (Full System Access - Endgame):**
*   Price Point: $19.99/month or $129.99/year.
*   Unlocks: All features of Option 1, plus the AI coach gains access to the full operating system data (all Pillars/Data sets), enabling comprehensive, constraint-aware, cross-pillar guidance (the "biohacking AI").

5.3. Packaging Logic
Users purchase access to the *system* (Pillars). Restricting the AI based on Pillar purchase ensures clean pricing and a strong incentive to upgrade to the full integrated system for holistic coaching.

6. Design and Aesthetics (MVP Direction)

6.1. Aesthetic Style
Duo-tone design language emphasizing dark modes.
Primary Dark Background: #2f3031
Primary Highlight/Accent: #c6c6c6
Rare Accent Colors: Strictly limited to Red and Blue, used sparingly for critical status indicators or actions.

7. Platform and Retention Hooks

7.1. Platform
Initial build targeted exclusively for **iOS**.

7.2. Adjacent Retention Hooks (Future Scope - Not MVP)
Features like custom phone wallpaper integration (for identity/reminders) and complex iPhone Shortcuts for quick logging/prompt launching are deferred past the MVP launch but acknowledged as high-value sticky features.

## Technology Stack
# TMLSN: Technology Stack Documentation (TechStack)

## 1. Overview and Rationale

TMLSN is being developed as a high-utility mobile application initially targeting ambitious, tech-savvy university students (18-24) on iOS. The architecture must support rapid iteration for MVP features (Tracking, Prompt Vault) while being inherently scalable to integrate complex data streams, AI coaching, and content distribution layers (Layers B, C, D, E).

The core strategy is to build a cohesive *operating system* rather than disparate tools. This necessitates a unified backend capable of handling siloed data (Free Tier) and integrating it seamlessly upon upgrade (Paid Tier).

## 2. Mobile Application Development (Frontend - MVP)

| Component | Technology | Justification |
| :--- | :--- | :--- |
| **Platform Target** | iOS Native (SwiftUI) | Initial focus is solely on iOS. SwiftUI provides a modern, declarative framework ensuring rapid UI development consistent with the duo-tone design aesthetic (Dark background: #2f3031, Highlights: #c6c6c6, Rare accents: Red/Blue). High-tech proficiency of the target user demands a native, polished experience. |
| **State Management** | Swift Combine / ObservableObjects | Robust, native framework for managing complex state changes required by logging activities, handling timers, and reacting to real-time prompt interactions. |
| **Local Caching** | Core Data / Realm (To be determined post-UX flow finalization) | Essential for offline usage of trackers and prompt vaults, crucial for users logging workouts/meals without immediate connectivity. Must support efficient migration from siloed data structures to integrated schemas upon upgrade. |
| **UI/UX Adjacency** | WidgetKit (iOS) | Supports adjacent retention hooks by allowing users to quickly view status or launch prompts/logging actions directly from the home screen. |
| **Shortcuts Integration** | Apple Shortcuts API | Directly supports retention hooks by allowing users to create quick-launch actions for prompt execution or quick logging entries. |

## 3. Backend Services and Data Management

The backend must handle transactional logging (trackers) and high-volume content distribution (prompts, content notifications).

| Component | Technology | Justification |
| :--- | :--- | :--- |
| **Primary Backend / API** | Node.js (Express Framework) or Python (FastAPI) | High performance, large community support. Node.js excels at I/O heavy operations typical of logging and notification services. FastAPI (Python) is preferred if AI/ML integration is prioritized early in the roadmap, though Node.js is sufficient for MVP APIs. |
| **Database (Primary)** | PostgreSQL | Chosen for its strong relational integrity, excellent support for complex querying required for future data aggregation (trends, adherence patterns), and support for JSONB fields necessary for flexible schema handling across Free/Paid tiers. |
| **Data Persistence Schema Strategy** | Multi-Schema Design within PostgreSQL | **MVP (Free):** Data stored primarily in separate tables/schemas corresponding to Layer A tools (Calorie_Logs, Workout_Logs). **Paid Upgrade:** Tables linking these silos are activated (e.g., `Goal_Adherence_Matrix`), and AI query layers are enabled. Data continuity ensured via user ID mapping. |
| **Food Database Integration** | USDA FoodData Central API / External Nutrition API (e.g., Edamam) | Necessary for accurate tracking of calories, macros, and micronutrients (Electrolytes: Mg, Ca, Na, K). Must handle conversions between metric/US customary units (volume/weight). |
| **AI Image Processing (Future/Layer E)** | Cloud Provider Vision API (e.g., Google Vision or AWS Rekognition) | Required for the user request to use image input for basic calorie estimation, interfacing with the primary food database lookup service. |
| **Content Management (Layer B/D)** | Headless CMS (e.g., Contentful, Strapi) or PostgreSQL Tables | Stores structured content, protocols, and the *Prompt Vault* library. Ensures decoupling between content deployment and app releases, allowing weekly prompt uploads without new app versions. |

## 4. Core Feature Implementation Details

### 4.1. Calorie / Nutrition Tracker (Layer A)

*   **Data Points:** Date, Meal Type (Breakfast, Lunch, Dinner, Snack), Calories, Protein, Carbs, Fat, Water Intake (mL/oz).
*   **Micronutrients:** Dedicated tracking for Magnesium, Calcium, Sodium, Potassium.
*   **Unit Handling:** Backend logic must robustly support conversion between Metric (grams, mL) and US Customary (ounces, cups, tsp/tbsp) inputs sourced via API/user settings.

### 4.2. Workout Tracker (Layer A)

*   **Logging Fields:** Exercise Name, Sets, Reps, Weight.
*   **Rest Timer:** Custom toggleable feature. Default rest times must be stored server-side, linked to specific exercises (e.g., compound lifts vs. isolation work).
*   **Notifications:** Backend service triggers push notifications to the client when the countdown timer expires.
*   **Predefined Workouts:** Storage for "TMLSN Split" templates, allowing users to initiate tracking from a pre-built session.

### 4.3. Prompt Vault (Layer B - Execution Engine)

*   **Mechanism:** Simple read-only storage view initially.
*   **Tech:** Backend stores Prompt Text and associated Content Link (Newsletter ID).
*   **Client Action:** Tapping the prompt triggers a secure copy action to the user's clipboard. No execution inside the app for MVP.

### 4.4. Notification System (Layer C - MVP Distribution)

*   **Service:** Firebase Cloud Messaging (FCM) or Apple Push Notification Service (APNS) Gateway managed via the backend.
*   **MVP Focus:** Purely *distributional* triggers (e.g., "New Newsletter is Live," "New YouTube Video Posted"). Contextual coaching triggers are deferred until Paid Tier implementation.

## 5. Deployment and DevOps

| Component | Technology | Justification |
| :--- | :--- | :--- |
| **Hosting Environment** | Cloud Provider (AWS preferred for scalability, or Digital Ocean for initial simplicity) | Robust hosting required to support API stability, database management, and eventual AI processing loads. |
| **Containerization** | Docker | Ensures environment parity between development, staging, and production, crucial for managing different database connection strings and API versions. |
| **CI/CD** | GitHub Actions / Fastlane | Automate testing and deployment pipelines directly to TestFlight for iOS builds, ensuring rapid iteration cycles necessary for MVP feature shipping. |

## 6. Security and Privacy Considerations

Given the highly sensitive nature of health, workout, and behavioral data:

1.  **Encryption in Transit:** All API communication must use HTTPS/TLS 1.2+.
2.  **Encryption at Rest:** Sensitive PII (User Profile, Health Data) must be encrypted at the database level.
3.  **Data Segmentation:** Clear separation enforced at the database layer between data required for the Free experience versus data integrated for the Paid Coaching/AI experience (as detailed in Data Persistence).
4.  **AI Interaction Logs (Paid):** Must be stored pseudonymized and offer explicit user controls for deletion as per GDPR/CCPA best practices.

## Project Structure
# TMLSN PROJECT STRUCTURE DOCUMENT

**Document Version:** 1.0
**Date:** October 26, 2023
**Project Name:** TMLSN App
**Target Platform:** iOS (MVP)

---

## 1. OVERVIEW

This document outlines the proposed file and folder structure for the TMLSN application MVP, focusing on the layered architecture described in the project thesis (Tools, Prompts, Notifications, Content, Coaching). The structure emphasizes separation of concerns to facilitate rapid iteration on the core tools while maintaining clear paths toward system integration and AI enablement.

## 2. CORE DIRECTORY STRUCTURE

The top-level structure is designed around standard mobile development practices, segregating source code, configuration, assets, and documentation.

```
TMLSN/
├── .github/                   # CI/CD configurations, workflows
├── Documentation/             # Project docs, architecture diagrams
├── Infrastructure/            # Backend/API configuration, cloud setup (if applicable)
├── Resources/                 # Static assets, design files, external libraries
├── Source/                    # Application Source Code (iOS - Swift/SwiftUI focus)
│   ├── App/                   # Application entry point, configuration
│   ├── Core/                  # Shared business logic, utilities, networking
│   ├── Features/              # Feature modules, organized by Project Layers
│   ├── Persistence/           # Data layer, schema definitions, local storage access
│   └── UI/                    # Shared UI components, theming, styles
└── Tests/                     # Unit and UI Tests
```

## 3. DETAILED FOLDER BREAKDOWN

### 3.1. Documentation/

Contains all project-related documentation.

```
Documentation/
├── Architecture/              # Architectural decision records (ADRs)
├── DataSchema/              # Detailed data models and persistence definitions
├── ProjectStructure.md      # This document
└── Readme.md
```

### 3.2. Resources/

Static assets and design specifications. The design aesthetic (dark theme: #2f3031, highlights: #c6c6c6, accents: Red/Blue) will be implemented via a central styling module in `UI/`.

```
Resources/
├── Assets.xcassets/         # Images, icons, app branding
├── Fonts/
├── DesignTokens/            # Color palette definitions, spacing guides
└── Mockups/                 # Design mocks (Figma/Sketch links)
```

### 3.3. Source/ - APPLICATION CODE

This is the core development directory, structured heavily around the Project Layers (A, B, C, D, E) for clarity.

#### 3.3.1. Source/App/

Application bootstrapping and environment setup.

```
Source/App/
├── TMLSNApp.swift           # Application main entry point
├── AppDelegate.swift        # (If required for legacy/specific lifecycle events)
└── Environment.swift        # Configuration for Dev/Staging/Production
```

#### 3.3.2. Source/Core/

Shared infrastructure used across multiple features.

```
Source/Core/
├── Networking/              # API Client, request builders, error handling
├── StateManagement/         # Global state containers (e.g., SwiftUI EnvironmentObjects)
├── Utilities/               # Generic helpers (Date formatting, validation)
└── LocationManager/         # Location services if needed for future features
```

#### 3.3.3. Source/Features/ (Layered Architecture)

This organizes code based on the strategic product layers.

```
Source/Features/
├── LayerA_Tools/            # MVP Core Functionality (Trackers)
│   ├── CalorieTracker/
│   │   ├── CalorieTrackerView.swift
│   │   ├── MealEntryModel.swift
│   │   └── FoodDatabaseService.swift  # Handles food DB interaction + Unit conversion logic
│   ├── WorkoutTracker/
│   │   ├── WorkoutTrackerView.swift
│   │   ├── WorkoutLogModel.swift
│   │   └── TMLSNSplitTemplate.swift  # Stores the predefined TMLSN splits
│   └── HabitUtilities/      # Placeholder for future timers/simple utilities
│
├── LayerB_Prompts/          # Execution Engine Component
│   ├── PromptVaultView.swift
│   ├── PromptModel.swift    # Includes text, source link, usage count
│   └── PromptService.swift  # Handles copy-to-clipboard logic
│
├── LayerC_Notifications/    # Logic for managing and responding to triggers
│   ├── NotificationHandler.swift # Handles push token registration and reception
│   └── CoachingTriggers/    # Logic for generating contextual coaching nudges (MVP: distribution only)
│
├── LayerD_Content/          # Content Display (MVP: Database integration placeholder)
│   ├── ContentFeedView.swift
│   └── ContentItemModel.swift
│
└── LayerE_Coaching/         # Empty for MVP, structure reserved for future AI/Planning integration
    └── AIInterfacePlaceholder.swift
```

#### 3.3.4. Source/Persistence/

Handling all data storage requirements, respecting the free vs. paid data silo structure initially.

```
Source/Persistence/
├── Database/                # Core persistence manager (e.g., CoreData stack, Realm setup)
├── Models/                  # Core Data/Object Models (Mirroring DataSchema)
│   ├── UserProfileSchema.swift
│   ├── CalorieEntry.swift   # Tracks date, meal type, macros, water intake
│   ├── WorkoutLog.swift     # Tracks exercise, sets, reps, weight, custom rest time
│   └── PromptUsage.swift    # Tracks which prompts were used and when
├── DataSilos/               # Logic distinguishing free vs. paid data access
│   ├── FreeTierDataAccessor.swift
│   └── PaidTierDataAggregator.swift  # Required for future trend analysis
└── ThirdPartyIntegrations/  # Placeholder for Food Database API client
```

#### 3.3.5. Source/UI/

Reusable UI components adhering to the duo-tone aesthetic.

```
Source/UI/
├── Components/              # Reusable elements (Buttons, Cards, Input Fields)
│   ├── ThemedButton.swift
│   └── DuoToneCardView.swift
├── Styles/                  # Centralized styling definitions
│   ├── Color+TMLSN.swift    # Defines #2f3031, #c6c6c6, Red, Blue
│   └── Typography.swift
└── Screens/                 # Top-level navigation views (Dashboard, Trackers, Vault)
```

## 4. DATA PERSISTENCE LAYOUT MAPPING

Data entities defined in `Source/Persistence/Models/` must map directly to the expanded requirements.

| Entity/Data Point | Layer | Storage Location (Local DB) | Initial Access (Free) | Notes |
| :--- | :--- | :--- | :--- | :--- |
| Calorie Entries (Basic) | A | `CalorieEntry` | Yes | Includes macros, water, meal timing segmentation. |
| Micronutrient/Electrolyte Tracking | A | `CalorieEntry.micros` (Expanded field) | Yes | Stored alongside main metrics. |
| Food Database Lookups | A | Remote Service | Yes | Requires Food Database API integration. |
| Water Intake | A | `CalorieEntry.water` | Yes | Separate section tracking. |
| Workout Logs (Sets/Reps/Weight) | A | `WorkoutLog` | Yes | Includes custom rest time toggle logic. |
| TMLSN Split Templates | A | `TMLSNSplitTemplate` | Yes | Pre-loaded workout data. |
| Prompt Text & Source Link | B | `PromptModel` | Yes | Click-to-copy functionality. |
| Saved/Custom Prompts | B | `UserPromptData` | Yes | Tracks usage history. |
| Content Metadata | D | `ContentItemModel` | Yes | Locally cached metadata for distribution alerts. |
| User Goals/Constraints | C/E | `UserProfileSchema` | Yes | Basic fields for plan context. |
| Purchase Status | E | `UserProfileSchema` | Yes | Determines feature gating. |
| **Aggregated Trends/Patterns** | Paid | N/A (Requires computation) | No (Requires Paid Tier) | Calculated only when data from all tools is connected. |
| **AI Interaction Logs** | Paid | Encrypted Storage | No | Reserved for future E Layer use. |

## 5. MONETIZATION HANDOVER POINTS

The structure must facilitate the clear demarcation between free and paid feature sets, primarily managed within the View/ViewModel logic checking the `UserProfileSchema.purchaseStatus`.

1.  **Tool Access (Layer A):** Trackers are available for free but do not share data contextually.
2.  **Prompt Vault (Layer B):** Fully functional for free users (copying).
3.  **Distribution Notifications (Layer C):** Functional for free users.
4.  **Integrated Systems/Data Aggregation:** Requires upgrade. Logic resides in `DataSilos/PaidTierDataAggregator.swift` and associated UI gating.
5.  **Mastering Aesthetics Course Access:** Gated behind the $19.99 tier check in the UI layer.

## Database Schema Design
SCHEMADESIGN: TMLSN APP (MVP FOCUS)

1. INTRODUCTION AND SCOPE

This document outlines the foundational database schema design for the TMLSN Application MVP. The design prioritizes supporting the core free-tier tools (Calorie Tracker, Workout Tracker, Prompt Vault) and establishing data persistence pathways necessary for future paid feature integration (Layer E - AI Coaching) and data unification.

The structure is designed to segment data based on functionality initially, allowing for siloed utility in the free tier, while ensuring all necessary components exist to merge these silos upon subscription upgrade.

2. CORE ENTITIES AND TABLES

2.1. User Management (AUTH & PROFILE)

| Table Name | Field Name | Data Type | Constraints/Notes | Purpose |
|---|---|---|---|---|
| USERS | user_id | UUID/PK | Primary Key, Auto-Generated | Unique user identifier. |
| USERS | email | VARCHAR(255) | UNIQUE, NOT NULL | User login credential. |
| USERS | password_hash | VARCHAR(255) | NOT NULL | Securely stored password hash. |
| USERS | first_name | VARCHAR(100) | | User's given name. |
| USERS | platform | ENUM('iOS') | NOT NULL (MVP) | Device platform registration. |
| USERS | unit_system | ENUM('METRIC', 'US') | DEFAULT 'METRIC' | Tracking preference (weight, volume). |
| USERS | created_at | TIMESTAMP | NOT NULL | Registration date. |
| USER_PROFILE | profile_id | UUID/PK | PK, FK to USERS | User specific metadata. |
| USER_PROFILE | user_id | UUID/FK | UNIQUE, NOT NULL | Link to USERS table. |
| USER_PROFILE | height_cm | DECIMAL(5,2) | | Used for BMR/TDEE calculations. |
| USER_PROFILE | current_weight_kg | DECIMAL(5,2) | | Current recorded weight. |
| USER_PROFILE | weight_goal_kg | DECIMAL(5,2) | | Target weight for tracking. |
| USER_PROFILE | subscription_tier | ENUM('FREE', 'PAID_A', 'PAID_ALL') | DEFAULT 'FREE' | Tracks current access level. |
| USER_PROFILE | aesthetic_course_progress | JSONB | | Tracks module completion for Mastering Aesthetics. |

2.2. Layer A: Tools - Workout Tracker

| Table Name | Field Name | Data Type | Constraints/Notes | Purpose |
|---|---|---|---|---|
| EXERCISES_MASTER | exercise_id | INT/PK | Auto-Increment | Master list of all exercises (pre-populated). |
| EXERCISES_MASTER | name | VARCHAR(255) | NOT NULL | e.g., Barbell Bench Press. |
| EXERCISES_MASTER | recommended_rest_sec | INT | Default: 90 | Default rest timer suggestion. |
| EXERCISES_MASTER | primary_muscle_group | VARCHAR(50) | | For future filtering/AI context. |
| WORKOUT_LOGS | log_id | UUID/PK | Auto-Generated | Unique workout session instance. |
| WORKOUT_LOGS | user_id | UUID/FK | NOT NULL | Which user performed the workout. |
| WORKOUT_LOGS | date | DATE | NOT NULL | Date of execution. |
| WORKOUT_LOGS | notes | TEXT | | Session notes. |
| WORKOUT_LOGS | template_id_fk | INT/FK | NULLABLE | If based on a pre-set TMLSN SPLIT template. |
| WORKOUT_SETS | set_id | UUID/PK | Auto-Generated | Unique set instance. |
| WORKOUT_SETS | log_id | UUID/FK | NOT NULL | Links to the session. |
| WORKOUT_SETS | exercise_id | INT/FK | NOT NULL | Which exercise was performed. |
| WORKOUT_SETS | set_number | INT | NOT NULL | Order of the set within the exercise. |
| WORKOUT_SETS | weight_value | DECIMAL(6,2) | | Weight used (unit derived from USER_PROFILE). |
| WORKOUT_SETS | reps_completed | INT | NOT NULL | Repetitions completed. |
| WORKOUT_SETS | rest_timer_active | BOOLEAN | NOT NULL | Whether custom rest timer was used for this set. |
| WORKOUT_SETS | rest_duration_sec | INT | | Actual rest time recorded or calculated. |

2.3. Layer A: Tools - Calorie & Nutrition Tracker

| Table Name | Field Name | Data Type | Constraints/Notes | Purpose |
|---|---|---|---|---|
| FOOD_DATABASE_MASTER | food_id | INT/PK | Auto-Increment | Master index of recognized food items. |
| FOOD_DATABASE_MASTER | name | VARCHAR(255) | NOT NULL | Food name (e.g., Chicken Breast). |
| FOOD_DATABASE_MASTER | energy_kcal | INT | | Energy in Kcal per standard serving. |
| FOOD_DATABASE_MASTER | protein_g | DECIMAL(5,2) | | Protein per standard serving. |
| FOOD_DATABASE_MASTER | carbs_g | DECIMAL(5,2) | | Carbohydrates per standard serving. |
| FOOD_DATABASE_MASTER | fat_g | DECIMAL(5,2) | | Fat per standard serving. |
| FOOD_DATABASE_MASTER | water_ml | INT | | Water content (optional). |
| FOOD_ENTRY_LOGS | entry_id | UUID/PK | Auto-Generated | Unique food entry instance. |
| FOOD_ENTRY_LOGS | user_id | UUID/FK | NOT NULL | Link to user. |
| FOOD_ENTRY_LOGS | date | DATE | NOT NULL | Date of consumption. |
| FOOD_ENTRY_LOGS | meal_type | ENUM('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK') | NOT NULL | Meal categorization. |
| FOOD_ENTRY_LOGS | food_id_fk | INT/FK | NULLABLE | If matched to master database. |
| FOOD_ENTRY_LOGS | custom_description | VARCHAR(255) | NULLABLE | User-entered description if no database match. |
| FOOD_ENTRY_LOGS | serving_quantity | DECIMAL(5,2) | NOT NULL | How many standard servings were consumed. |
| FOOD_ENTRY_LOGS | serving_unit | VARCHAR(50) | | e.g., "cup", "grams", "tbsp" (Unit mapping needed). |
| FOOD_ENTRY_LOGS | calories_logged | INT | Calculated/Entered | Total Calories for this entry. |
| FOOD_ENTRY_LOGS | protein_logged_g | DECIMAL(5,2) | Calculated/Entered | Total Protein. |
| FOOD_ENTRY_LOGS | image_data | BYTEA/JSONB | NULLABLE | Stored reference or metadata from AI image scanning API. |
| WATER_LOGS | water_log_id | UUID/PK | Auto-Generated | Unique water entry. |
| WATER_LOGS | user_id | UUID/FK | NOT NULL | Link to user. |
| WATER_LOGS | date | DATE | NOT NULL | Date of entry. |
| WATER_LOGS | volume_ml | INT | NOT NULL | Volume tracked. |
| NUTRIENT_LOGS | log_id | UUID/PK | Auto-Generated | Tracking specialized micronutrients (MVP extension). |
| NUTRIENT_LOGS | user_id | UUID/FK | NOT NULL | Link to user. |
| NUTRIENT_LOGS | date | DATE | NOT NULL | Date of entry. |
| NUTRIENT_LOGS | nutrient_type | ENUM('MAGNESIUM', 'CALCIUM', 'SODIUM', 'POTASSIUM') | NOT NULL | Specific micronutrient. |
| NUTRIENT_LOGS | amount_mg | DECIMAL(6,2) | NOT NULL | Amount tracked. |

2.4. Layer B: Prompt Vault

| Table Name | Field Name | Data Type | Constraints/Notes | Purpose |
|---|---|---|---|---|
| PROMPTS_MASTER | prompt_id | UUID/PK | Auto-Generated | Unique identifier for the prompt template. |
| PROMPTS_MASTER | title | VARCHAR(255) | NOT NULL | Prompt short description. |
| PROMPTS_MASTER | content_text | TEXT | NOT NULL | The actual text content of the AI prompt. |
| PROMPTS_MASTER | source_content_link | VARCHAR(512) | NOT NULL | Link to the newsletter/post containing the advice. |
| PROMPTS_MASTER | category_tag | VARCHAR(100) | INDEX | For filtering (e.g., "Productivity", "Aesthetics"). |
| PROMPTS_MASTER | is_active | BOOLEAN | DEFAULT TRUE | Control visibility of master prompts. |
| USER_SAVED_PROMPTS | user_prompt_link_id | UUID/PK | Auto-Generated | Linking table. |
| USER_SAVED_PROMPTS | user_id | UUID/FK | NOT NULL | Link to user. |
| USER_SAVED_PROMPTS | prompt_id_fk | UUID/FK | NOT NULL | The prompt they saved/interacted with. |
| USER_SAVED_PROMPTS | custom_alias | VARCHAR(255) | NULLABLE | User-defined name for the saved prompt. |
| USER_PROMPT_USAGE | usage_id | UUID/PK | Auto-Generated | Tracking execution. |
| USER_PROMPT_USAGE | user_id | UUID/FK | NOT NULL | Link to user. |
| USER_PROMPT_USAGE | prompt_id_fk | UUID/FK | NOT NULL | The prompt executed. |
| USER_PROMPT_USAGE | execution_timestamp | TIMESTAMP | NOT NULL | When the user clicked copy. |

2.5. Layer C: Notifications & Distribution

| Table Name | Field Name | Data Type | Constraints/Notes | Purpose |
|---|---|---|---|---|
| USER_NOTIFICATION_PREFS | pref_id | UUID/PK | Auto-Generated | Preferences instance. |
| USER_NOTIFICATION_PREFS | user_id | UUID/FK | UNIQUE, NOT NULL | Link to user. |
| USER_NOTIFICATION_PREFS | allow_distribution_alerts | BOOLEAN | DEFAULT TRUE | Opt-in for YT/Newsletter drops. |
| USER_NOTIFICATION_PREFS | coaching_triggers_enabled | BOOLEAN | DEFAULT FALSE (MVP) | For future coaching notifications. |
| DISTRIBUTION_ALERTS | alert_id | UUID/PK | Auto-Generated | Unique alert broadcast. |
| DISTRIBUTION_ALERTS | type | ENUM('NEWSLETTER', 'YOUTUBE') | NOT NULL | Type of content drop. |
| DISTRIBUTION_ALERTS | title | VARCHAR(255) | NOT NULL | Alert subject. |
| DISTRIBUTION_ALERTS | deep_link_url | VARCHAR(512) | NOT NULL | Destination URL/App section. |
| DISTRIBUTION_ALERTS | created_at | TIMESTAMP | NOT NULL | When the alert was pushed. |

3. DATA PERSISTENCE AND UPGRADE LOGIC (FREE TO PAID)

The structure facilitates the transition from siloed data (Free) to integrated data (Paid) without losing history:

3.1. Data Continuity

All Layer A tool data (WorkoutLogs, FoodEntryLogs, WaterLogs) are inherently tied to the `user_id`. This data set remains intact upon upgrade.

3.2. Paid Unlock Status

The `subscription_tier` field in the `USER_PROFILE` table dictates access:
*   FREE: Only allows interaction with base CRUD operations for Layer A tools and viewing of available Master Prompts (Layer B).
*   PAID_A (Aesthetics Mastery): Unlocks Mastering Aesthetics content access and, crucially, unlocks the ability for the user's data history to be aggregated and queried for trend analysis (prerequisite for Coaching Layer E).
*   PAID_ALL (Full System/AI Ready): Grants access to all features, including the initial AI Coach queries based on aggregated data.

3.3. Integration Hooks (Future State)

While the MVP separates data entry, future integration relies on:
1.  **Cross-Tool Querying:** Paid features require complex SQL joins between `WORKOUT_LOGS`, `FOOD_ENTRY_LOGS`, and potentially `USER_PROFILE` metrics (e.g., calculating adherence percentage across nutrition and training goals).
2.  **AI Interaction Logging:** The `AI_INTERACTION_LOGS` table (Post-MVP, Paid Feature) will reference `log_id`s from Workout and Food logs to attribute coaching decisions to specific data points.

4. MVP TEMPLATE STRUCTURES

4.1. TMLSN SPLIT TEMPLATES (Workout Templates)

This table will store the pre-defined workout routines the user can select to "Run."

| Table Name | Field Name | Data Type | Constraints/Notes | Purpose |
|---|---|---|---|---|
| WORKOUT_TEMPLATES | template_id | INT/PK | Auto-Increment | Master ID for a specific split. |
| WORKOUT_TEMPLATES | name | VARCHAR(255) | NOT NULL | e.g., "TMLSN PPL Day 1". |
| WORKOUT_TEMPLATES_EXERCISES | template_exercise_id | UUID/PK | Auto-Generated | Linking specific exercises to the template. |
| WORKOUT_TEMPLATES_EXERCISES | template_id_fk | INT/FK | NOT NULL | Which template this belongs to. |
| WORKOUT_TEMPLATES_EXERCISES | exercise_id_fk | INT/FK | NOT NULL | Which exercise is prescribed. |
| WORKOUT_TEMPLATES_EXERCISES | prescribed_sets | INT | NOT NULL | Default sets for this template. |
| WORKOUT_TEMPLATES_EXERCISES | prescribed_reps | VARCHAR(50) | NOT NULL | Range or fixed reps (e.g., "8-12"). |
| WORKOUT_TEMPLATES_EXERCISES | default_rest_sec | INT | | Template specific rest recommendation. |

5. DESIGN AND AESTHETICS MAPPING

The schema does not strictly enforce UI aesthetics, but fields are included to support the specified duotone design (Dark: #2f3031, Highlight: #c6c6c6, Accents: Red/Blue).

*   User Interface elements will interpret the data structure, using `subscription_tier` to conditionally display accent colors reserved for paid features.
*   Timers (`rest_timer_active`, `rest_duration_sec` in `WORKOUT_SETS`) will utilize the system's native countdown mechanisms, triggering user notifications when complete.

## User Flow
TMLSN USER FLOW DOCUMENT (MVP SCOPE)

1. OVERVIEW AND GOALS (MVP)

1.1. Document Purpose
This document details the core user journeys, interaction patterns, and high-level wireframe requirements for the TMLSN Minimum Viable Product (MVP). The MVP focuses on delivering immediate, standalone utility (Layer A Tools) while setting the foundation for future integration and monetization.

1.2. MVP Goal
To quickly onboard ambitious, tech-savvy users (18-24 year old males) by providing immediately useful, free-to-use tracking tools (Calorie, Workout) linked to actionable advice (Prompt Vault), thereby converting attention into retained users who are primed for paid ecosystem entry.

1.3. Core User Profile (Primary Target)
Ambitious university student, high tech proficiency, insecure about appearance/confidence, seeking structure but prone to routine sabotage. Needs simple, effective tools.

2. HIGH-LEVEL APPLICATION STRUCTURE (MVP LAYERS)

The MVP primarily encompasses Layer A (Tools) and the foundational infrastructure for Layer B (Prompt Vault) and Layer C (Distribution Notifications).

2.1. Layer A: Tools (Free Entry)
*   Calorie/Nutrition Tracker
*   Workout Tracker (with pre-loaded TMLSN Splits)
*   Prompt Vault (Read/Copy functionality)

2.2. Layer B: Execution Engine Foundation
*   Prompt Vault integration: Linking prompts to external content source (URL).

2.3. Layer C: Distribution Hooks (MVP)
*   Static distribution notifications (e.g., Newsletter/YouTube drop alerts).

2.4. Monetization Trigger (Handover Point)
The switch from free utility to paid subscription occurs when accessing advanced data aggregation, connected insights, or the Mastering Aesthetics course content.

3. CORE USER FLOWS (MVP)

3.1. Flow 1: First-Time User Onboarding & Profile Setup

*   **Screen 1: Splash/Branding:** TMLSN logo, Duo-tone aesthetic (2f3031 dark background, c6c6c6 foreground).
*   **Screen 2: Value Proposition:** Concise statement: \"Track. Execute. Transform.\" (Taps into ambition/pain points).
*   **Screen 3: Account Creation/Login:** Standard options (Apple/Google/Email).
*   **Screen 4: Initial Setup (Goals & Constraints):**
    *   Input: Basic User Profile (Height, Current Weight).
    *   Input: Primary Goal (e.g., Muscle Gain, Fat Loss, General Health).
    *   Input: Unit Preference Toggle (Metric vs. US).
    *   Input: Dietary Restrictions (Minimal selection to avoid complexity; e.g., Vegetarian, None).
*   **Screen 5: Tool Introduction (Interstitial):** Brief tutorial pop-ups introducing the Calorie Tracker and Workout Tracker as standalone tools.
*   **Screen 6: Home Dashboard (Default View):** Shows entry points to major tools.

3.2. Flow 2: Calorie & Nutrition Tracking (Daily Use)

*   **Screen 1: Home Dashboard** -> Taps \"Nutrition Tracker\" button.
*   **Screen 2: Daily Summary View:** Defaults to Today's Date. Displays macro breakdown targets (Calories, Protein, Carbs, Fat) and Water intake summary. Sections for Breakfast, Lunch, Dinner, Snack.
*   **Screen 3: Logging Food (Entry Point):** User taps \"+\" next to a meal time (e.g., Lunch).
*   **Screen 4: Food Search/Input:**
    *   Option A: Search Food Database (Integrated API). User searches term (e.g., \"Chicken Breast\").
    *   Option B: Manual Entry (Food Name, Calories, Macros).
    *   Option C: AI Image Logging (Placeholder/Future State): User takes a photo. Displays message: \"Image analysis enabled upon subscription upgrade.\" (MVP focuses on manual/search).
    *   Unit selection toggle (g/oz/cups/spoons) available next to quantity input.
*   **Screen 5: Confirmation & Addition:** User confirms quantity and serving size. Added to the meal summary.
*   **Screen 6: Micronutrient Check (Optional Visibility):** User can expand the daily view to see logged electrolytes (Mg, Ca, Na, K). Water intake tracked separately (simple counter/volume input).
*   **Screen 7: Return to Daily Summary:** Macros update in real-time.

3.3. Flow 3: Workout Logging & Execution (Progressive Overload Focus)

*   **Screen 1: Home Dashboard** -> Taps \"Workout Tracker\" button.
*   **Screen 2: Workout Library/History:**
    *   Section A: **\"TMLSN Splits\"** (Pre-loaded templates).
    *   Section B: User History (Past completed workouts).
    *   Button: \"Start New Freeform Workout\".
*   **Screen 3A: Executing a TMLSN Split:** User selects a saved split (e.g., \"TMLSN Upper Body A\").
    *   System pre-populates the exercise list (Exercise Name, default Sets/Reps/Weight).
*   **Screen 3B: Starting Freeform Workout:** User starts with a blank slate, must manually add exercises.
*   **Screen 4: Active Workout Screen (Per Exercise):**
    *   Displays: Exercise Name, Target Sets (e.g., Set 1 of 3).
    *   Input Fields: Weight (lb/kg), Reps completed.
    *   Toggle: **Rest Timer Activation** (Default state: Off).
    *   If Timer is ON: System shows Recommended Timer duration (based on exercise type).
*   **Screen 5: Rest Timer Interaction:**
    *   Upon completing a set entry, if the timer is active, the screen shifts focus to a **Countdown Timer Interface**. (Duo-tone design with red/blue accents if the countdown is actively running).
    *   **Notification Trigger:** When the countdown hits zero, a push notification fires: \"Rest time up for [Exercise Name]! Time for Set X.\"
*   **Screen 6: Completion:** User finishes all sets/exercises and taps \"End Workout.\" Workout is saved to history.

3.4. Flow 4: Prompt Vault Utilization (Layer B Execution)

*   **Screen 1: Home Dashboard** -> Taps \"Prompt Vault\" button.
*   **Screen 2: Prompt Library:** Displays a scrollable list of available prompts, organized perhaps by newest first (weekly uploads are key).
    *   Each entry shows: Prompt Title/Summary, Source Link (e.g., \"From Newsletter 007\").
*   **Screen 3: Prompt Detail View:**
    *   Displays the full text of the prompt within a distinct text box area.
    *   **Interaction:** A prominent \"Copy to Clipboard\" button directly beneath the prompt text.
    *   **External Link:** Clickable link to the source material (Newsletter/Article).
*   **Flow Continuation (Outside App):** User copies the prompt, switches context to their primary AI interface (e.g., ChatGPT), and pastes the prompt to execute the derived action.

4. INTERACTION PATTERNS AND DESIGN NOTES

4.1. Aesthetic Direction
*   Primary palette: Dark mode focus (Background: #2f3031).
*   Secondary/Text: #c6c6c6.
*   Accent Colors: Rare, strategic use of Red and Blue for emphasis (e.g., Rest Timer running, critical metric alerts, CTA buttons).

4.2. Data Persistence Interaction (MVP Silos)
*   Calorie Data, Workout Data, and Prompt Usage History are stored locally/independently within the free application database schema.
*   No cross-pollination or automated reporting between the two tools is present in the MVP.

4.3. Monetization Handover Point
*   Accessing any content related to \"Mastering Aesthetics Course\" redirects to a subscription wall.
*   Accessing aggregated trend data, historical pattern analysis, or AI coaching features redirects to the subscription wall.

4.4. Notification Strategy (MVP - Distribution Only)
*   Notifications are strictly inbound distribution hooks for free users:
    *   \"New TMLSN Newsletter is live! Read it now.\"
    *   \"New TMLSN YouTube Video uploaded.\"
*   In-app workout timers trigger local device notifications (as per Flow 3).

4.5. Adjacent Hook Integration (Conceptual for MVP Infrastructure)
*   While complex wallpaper/shortcut integration is secondary, the underlying data structure must allow future hooks (e.g., a basic API endpoint for fetching today's key metric summary, if required for system compatibility).

## Styling Guidelines
TMLSN Styling Guidelines Document (MVP Focus)

1. Introduction
This document outlines the core styling principles, color palette, typography, and general UI/UX direction for the TMLSN application, focusing on the Minimum Viable Product (MVP). The design aims to be structured, cohesive, and highly functional, serving the ambitious, tech-savvy 18-24 year old male demographic. The aesthetic should subtly convey seriousness and potential, aligning with the theme of structured self-optimization.

2. Design Aesthetic Direction: Duo-Tone Foundation

The primary design language for TMLSN is stark, high-contrast, and minimalist, emphasizing data clarity and actionability over superfluous decoration.

2.1. Color Palette

The MVP utilizes a strict duo-tone structure with extremely limited accent usage.

| Name | Hex Code | Usage | Notes |
| :--- | :--- | :--- | :--- |
| Primary Dark Background | #2F3031 | Primary Backgrounds, Cards, Nav Bars | Deep, near-black tone. Ensures high contrast for text and functional elements. |
| Primary Light Surface/Text | #C6C6C6 | Primary Text, Disabled States, Secondary Backgrounds | Muted gray intended to act as the primary interactive or content color against the dark background. |
| Accent Red | #FF0000 | Critical Alerts, Error States, Key Motivational Triggers (e.g., "Do it Now" nudges) | Used extremely sparingly. Must signify immediate attention or urgency. |
| Accent Blue | #0000FF | Positive Feedback, Completion Indicators, Success States, Selected States in Trackers | Used sparingly to denote successful logging or selection. |
| Neutral White/Off-White | #FFFFFF | Explicit Highlights, Headings (when necessary for hierarchy) | Used only for high-priority titles or icons that must pop off the dark background. |

2.2. Iconography and Imagery

Icons should be simple, linear, and mono-line when possible, adhering strictly to the Primary Light Surface color (#C6C6C6) unless conveying status (Red/Blue accents). Imagery, particularly related to "Mastering Aesthetics" or content integration, should be high-quality but treated with a desaturated or monochromatic filter to maintain the strict duo-tone feel.

3. Typography

Clarity, readability, and modern technical feel are paramount. We will rely on system fonts or a single, clean sans-serif typeface that handles numerical data well.

3.1. Font Stack (iOS Focus)

*   Primary: San Francisco (System Font for iOS)
*   Fallback: Any clean, geometric sans-serif (e.g., Roboto, Inter)

3.2. Typographic Hierarchy

| Element | Weight | Size (pt) | Color | Use Case |
| :--- | :--- | :--- | :--- | :--- |
| H1 (Screen Titles) | Bold | 28 - 34 | #FFFFFF / #C6C6C6 | Top-level navigation titles. |
| H2 (Section Headers) | SemiBold | 20 - 24 | #C6C6C6 | Headers within tool screens (e.g., "Today's Workout"). |
| Body Text (Standard) | Regular | 16 - 18 | #C6C6C6 | General content, instructions, descriptions. |
| Data Values (Trackers) | Medium/Bold | 18 - 22 | #FFFFFF | Displaying current calories, weight lifted, etc. |
| Labels/Metadata | Regular | 12 - 14 | #C6C6C6 (Slightly muted if possible) | Labels for inputs, timestamps, source notes. |
| Prompt Text (Vault) | Regular | 16 | #C6C6C6 | The core text users copy. Must be highly legible. |

4. UI/UX Principles

The design must directly support the goal: converting attention into executed action via structured tools.

4.1. Structure and Layout

*   **Card-Based System:** Utilize elevated, dark cards (#2F3031) on slightly lighter dark backgrounds (if necessary for separation) to segment tools (Calorie Tracker, Workout Logger, Prompt Vault).
*   **Negative Space:** Generous negative space (using the dark background) is crucial for separating functional zones and reducing visual clutter, aligning with a focused, "no-nonsense" approach.
*   **Data Density (Trackers):** The calorie and workout trackers should prioritize displaying current status and logging efficiency. Data should be clearly quantified using large Data Values typography.

4.2. Interactivity and Feedback

*   **Tap States:** All tappable elements (buttons, list items) must provide immediate visual feedback, utilizing a subtle overlay of the Primary Light color (#C6C6C6) or a momentary shift to Accent Blue (#0000FF) upon press.
*   **Rest Timer Notification:** When the rest timer countdown (Workout Tracker) expires, the corresponding notification must be assertive, potentially utilizing the Accent Red (#FF0000) sparingly in the notification UI itself, or through an aggressive haptic feedback pattern on iOS.
*   **Prompt Vault Interaction:**
    *   The prompt text box must clearly display the source link above it.
    *   A large, dedicated "Copy to Clipboard" action must be immediately adjacent to the text box. Success confirmation should be a brief, non-intrusive toast notification using the Accent Blue.

4.3. Tool-Specific Styling Notes (MVP)

**A. Calorie/Nutrition Tracker:**
*   Input fields for macros (Calories, Protein, Carbs, Fat) should use clean, bordered input boxes using #C6C6C6 lines.
*   Water tracking should be represented by a simple visual tally or clear input field, separated from macro tracking.
*   The API-driven picture logging feature must feature a large, clear camera/upload icon, adhering to the duo-tone aesthetic.

**B. Workout Tracker:**
*   Log entry inputs (Sets, Reps, Weight) should use numeric keypads where appropriate.
*   The "TMLSN Split" pre-loaded workouts should be clearly labeled and instantly launchable (a high-contrast Blue button).
*   The rest timer toggle/display must be highly visible, potentially using a subtle blue progress indicator around the countdown text when active.

**C. Prompt Vault:**
*   The layout should resemble a clean, searchable list. Each entry displays the prompt title/summary and the linked content source (newsletter issue number/date).
*   The action of copying is the primary goal; this button must be highly accessible (large, distinct).

5. Accessibility and Platform Considerations (iOS Focus)

*   **Contrast:** Due to the high-contrast duo-tone structure, standard WCAG contrast ratios for text on background should be easily met or exceeded, ensuring readability even in bright environments.
*   **Haptics:** Utilize native iOS haptic feedback for confirmations (e.g., saving a log, copying a prompt, timer completion) to reinforce actions without relying solely on visual changes.
*   **Scalability:** Ensure all text elements respect Dynamic Type settings to accommodate users needing larger text sizes, while maintaining the structural integrity defined by the card system.
