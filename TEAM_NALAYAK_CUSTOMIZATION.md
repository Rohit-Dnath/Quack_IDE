# Team Nalayak VS Code Customization

This repository contains a heavily customized version of VS Code with the following changes:

## 🦆 Welcome Screen Customization

### Changes Made:
1. **Custom Tagline**: Changed from "Customize your editor, learn the basics, and start coding" to "Built by Team Nalayak. Quack if you leak."

2. **Removed Theme Selection**: Completely removed the theme picker step from the getting started experience to streamline the onboarding.

3. **Custom Logo**: Added Team Nalayak logo (`welo.png`) from the win32 resources to the welcome screen.

4. **Visual Enhancements**:
   - Animated gradient title with Team Nalayak colors
   - Custom animations including bouncing logo and duck emoji
   - Enhanced button hover effects
   - Colorful background patterns
   - Special styling for Team Nalayak welcome steps

5. **Layout Changes**:
   - Activity bar moved to top by default
   - Sidebar moved to right by default
   - Custom start entry with Team Nalayak branding

## 🎨 Design Elements

- **Color Scheme**: Blue (#007ACC), Light Blue (#4FC1FF), Red (#FF6B6B), Teal (#4ECDC4)
- **Animations**:
  - Gradient text animation for titles
  - Bouncing logo animation
  - Duck emoji wiggle animation
  - Smooth hover transitions
- **Typography**: Centered titles with enhanced styling

## 📁 Files Modified

1. `src/vs/workbench/browser/workbench.contribution.ts` - Activity bar and sidebar defaults
2. `src/vs/workbench/browser/layout.ts` - Sidebar position runtime state
3. `src/vs/workbench/contrib/welcomeGettingStarted/common/gettingStartedContent.ts` - Welcome content
4. `src/vs/workbench/contrib/welcomeGettingStarted/browser/media/gettingStarted.css` - Custom styling
5. `src/vs/workbench/contrib/welcomeGettingStarted/common/media/welo.png` - Team logo

## 🚀 Build Instructions

```bash
npm run compile
./scripts/code.bat  # or ./scripts/code.sh on Unix
```

## 🎯 Features

- Unique "Quack if you leak" branding
- Playful duck-themed animations
- Team Nalayak logo integration
- Non-typical welcome screen design
- Enhanced user experience with custom styling

---

**Built with ❤️ by Team Nalayak** 🦆
