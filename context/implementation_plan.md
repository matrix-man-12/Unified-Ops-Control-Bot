# Custom Dialogs & Premium Alerts System

Migrate all native, unpolished browser alert() and confirm() popups to a premium, custom styled notification and modal confirmation system matching the organic bronze and terracotta design of the operational dashboard.

## Proposed Changes

### [Root System Components]

#### [NEW] [GlobalConfirmModal.jsx](file:///e:/2026/May/AI_Bot/frontend/src/components/GlobalConfirmModal.jsx)
- Elegant, blurred overlay displaying operation-specific prompts (destructive delete actions are colored in a Rose theme, while normal actions use the warm Amber/bronze design).
- Fully accessible confirm and cancel states with smooth animation entries.

#### [NEW] [GlobalToastContainer.jsx](file:///e:/2026/May/AI_Bot/frontend/src/components/GlobalToastContainer.jsx)
- Top-right corner stacking system for ephemeral operations status (success, error, warning, info) with smooth fade-in animations and automatic dismissals.

### [Frontend View Integration]

#### [MODIFY] [App.jsx](file:///e:/2026/May/AI_Bot/frontend/src/App.jsx)
- Integrates local state arrays for active toast lists and modal parameter structures.
- Provides `showToast()` and `showConfirm()` callback interfaces.
- Protects historical run cancellations/deletion streams.

#### [MODIFY] [PortalSelector.jsx](file:///e:/2026/May/AI_Bot/frontend/src/components/PortalSelector.jsx)
- Consumes `showToast` and `showConfirm` from properties.
- Replaces raw portal deletions, skill imports, and skill deletion confirms with custom UI sheets.

#### [MODIFY] [ChatWindow.jsx](file:///e:/2026/May/AI_Bot/frontend/src/components/ChatWindow.jsx)
- Destructures state handlers.
- Upgrades inline attachment uploads error reporting to utilize the polished toast sheets.

#### [MODIFY] [SkillStudio.jsx](file:///e:/2026/May/AI_Bot/frontend/src/components/SkillStudio.jsx)
- Upgrades editor spec file uploads to utilize the new non-blocking toast UI sheets.

#### [MODIFY] [FileUploader.jsx](file:///e:/2026/May/AI_Bot/frontend/src/components/FileUploader.jsx)
- Upgrades draft validation triggers to invoke custom warnings.

## Verification Plan

### Automated Build Verification
- Execute production-level compiler tests: `npm run build`

### Manual Verification
1. Attempt to delete a chat session runbook. Ensure the custom Rose-themed destruct confirm modal surfaces.
2. Attempt to delete a portal configuration profile. Check modal synchrony.
3. Attempt to delete a custom skill. Verify custom prompt sheet is triggered instead of default browser warning.
4. Verify non-blocking status error messages appear in toast format instead of blocking alerts.
