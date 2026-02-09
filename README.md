# Technics Master Edition MKII

A vintage-inspired, high-fidelity web audio player that recreates the premium experience of classic Technics audio equipment with modern web technologies.

![Technics Master Edition MKII](img/Technics_cover.png)
<img width="1875" height="797" alt="1" src="https://github.com/user-attachments/assets/f9091b9e-b6fc-481c-b5d8-74f2185ccff5" />

## Overview

Technics Master Edition MKII is a fully-functional web-based audio player that combines nostalgic design elements from classic Hi-Fi equipment with modern audio capabilities. It features a detailed vacuum fluorescent display (VFD) simulation, comprehensive playback controls, and advanced audio processing features.

## Features

### Core Playback

- **Multi-format Support**: Plays MP3, FLAC, WAV, and other common audio formats
- **Playlist Management**: Load and manage multiple tracks with visual track indicators
- **Transport Controls**: Play, pause, stop, next, previous, fast forward, and rewind
- **A-B Repeat**: Loop specific sections of tracks with visual lock indicator
- **Track Navigation**: Direct track access via numeric keypad (1-20+ tracks)
- **Shuffle & Repeat**: Random playback and repeat modes (single track or all)

### Audio Visualization & Metering

- **VU Meters**: Real-time stereo VU meters with color-coded zones (blue/orange/red)
- **dB Scale**: Accurate -40dB to +3dB scale display
- **Peak Search**: Automatically find the loudest moment in a track
- **VU Sensitivity Control**: Adjustable meter sensitivity (0.2x to 8.0x)

### Audio Processing

- **Bass Control**: Low-shelf EQ filter (±10dB at 200Hz)
- **Treble Control**: High-shelf EQ filter (±10dB at 3000Hz)
- **Volume Control**: Smooth volume adjustment with visual feedback
- **Mute Function**: Quick mute/unmute with volume preservation

### Visual Interface

- **VFD Display Simulation**: Authentic vacuum fluorescent display aesthetics with customizable colors
- **Motorized Tray Animation**: Smooth open/close tray mechanism with CSS animations
- **Time Display Modes**: Elapsed time or remaining time with negative countdown
- **Track Grid**: Visual representation of loaded tracks (1-20) with overflow indicator
- **Album Art Viewer**: Full-screen album art display with metadata
- **Customizable Appearance**: Adjustable VFD color, background color, and shadow effects

### Advanced Features

- **Hidden Control Panel**: Sliding hatch mechanism reveals tone and utility controls
- **Media Session API**: Integration with OS media controls and lock screen
- **Metadata Support**: Reads ID3 tags for artist, album, title, and artwork
- **Progressive Web App**: Installable as a standalone application
- **Offline Support**: Service worker caching for offline functionality
- **Keyboard Navigation**: Full keyboard control support

## Installation

### Online Use

Simply open `index.html` in a modern web browser (Chrome, Firefox, Safari, Edge).

### Local Installation

1. Clone or download this repository
1. Ensure all files are in the same directory structure:
   
   ```
   /
   ├── index.html
   ├── style.css
   ├── script.js
   ├── sw.js
   ├── manifest.json
   └── img/
       ├── Technics_logo.png
       ├── HR_logo.png
       ├── mash_logo_t.png
       ├── Technics_cover.png
       └── favicon.png
   ```
1. Open `index.html` in your browser

### PWA Installation

1. Visit the application in Chrome, Edge, or Safari
1. Click the install icon in the address bar
1. Confirm installation to add to your home screen/applications

## Usage

### Loading Music

1. Click **OPEN/CLOSE** or the tray area to open the virtual disc tray
1. Click **”- SELECT TRACKS -”** to browse your local files
1. Select one or multiple audio files
1. The tray will close automatically and load the first track

### Basic Playback

- **PLAY/PAUSE**: Start or pause playback
- **STOP**: Stop playback and reset to beginning
- **NEXT/PREV**: Navigate between tracks
- **Numeric Keys (1-0)**: Jump directly to tracks (enter two digits for tracks 10+)

### Advanced Controls

- **Time Mode**: Toggle between elapsed time and remaining time display
- **A-B Repeat**:
  - Press once to set point A (display blinks)
  - Press again to set point B (creates loop)
  - Press third time to clear A-B points
- **Peak Search**: Automatically locate the loudest part of the current track
- **Random**: Enable/disable shuffle mode
- **Repeat**: Cycle through off → repeat one → repeat all

### Audio Adjustment

1. Click the bottom panel to reveal the hidden controls
1. Use **Bass +/-** and **Treble +/-** for tonal adjustments
1. Use **VU +/-** to adjust meter sensitivity
1. **RESET** button returns bass and treble to neutral (0dB)

### Customization

- **VFD Color**: Click the Technics logo to cycle through display colors (white, silver, blue, gray)
- **Background Color**: Use the color picker in the hidden panel
- **Shadow Color**: Adjust the deck’s drop shadow color

### Track Management

- **TRACK LIST**: View all loaded tracks with highlighting of current track
- **COVER**: View full-screen album artwork with metadata
- Click track numbers (1-20 grid) to open track list

## Keyboard Shortcuts

|Key   |Function                           |
|------|-----------------------------------|
|Space |Play/Pause                         |
|0-9   |Direct track access (numeric input)|
|←     |Previous track                     |
|→     |Next track                         |
|Escape|Close modals                       |

## Technical Details

### Technologies Used

- **HTML5 Audio API**: Core audio playback
- **Web Audio API**: Real-time analysis, EQ filters, and VU metering
- **MediaSession API**: OS-level media controls
- **Service Worker**: Offline capability and caching
- **LocalStorage**: Preference persistence (VFD color, background)
- **jsmediatags**: ID3 tag reading for metadata
- **CSS3**: Animations, gradients, and advanced styling
- **Font Awesome**: Icon library for controls

### Browser Compatibility

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Opera 76+

### Audio Processing Chain

```
Audio Source → Bass Filter → Treble Filter → Analyzer → Destination
                (200Hz)       (3000Hz)       (FFT)
```

### Performance

- FFT Size: 64 samples for real-time VU metering
- VU Update Rate: 60fps via requestAnimationFrame
- Time Display Update: Event-driven (ontimeupdate)

## File Structure

```
├── index.html          # Main HTML structure
├── style.css           # All styling and VFD effects
├── script.js           # Audio engine and UI logic
├── sw.js               # Service worker for PWA
├── manifest.json       # PWA manifest
└── img/                # Image assets
    ├── Technics_logo.png
    ├── HR_logo.png
    ├── mash_logo_t.png
    ├── Technics_cover.png
    └── favicon.png
```

## Limitations

- Browser storage limits apply to offline caching
- Web Audio API requires user interaction before first play (browser security)
- Rewind function uses backward seeking (no actual reversed audio)
- Maximum practical playlist size: ~100 tracks for optimal performance
- VU meters display stereo analysis from frequency data (not true peak metering)

## Customization

### Changing VFD Colors

Edit the `vfdColors` array in `script.js`:

```javascript
const vfdColors = ['#ffffff', '#a0a0a0', '#DBE9FF', '#B5B5B5'];
```

### Adjusting Default Volume

Modify the initial volume in `script.js`:

```javascript
audio.volume = 0.02; // Range: 0.0 to 1.0
```

### Modifying EQ Ranges

Change filter parameters in `setupAudio()`:

```javascript
bassFilter.frequency.value = 200;    // Hz
trebleFilter.frequency.value = 3000; // Hz
```

## Credits

**Author**: Yohann Zaoui  
**Design Inspiration**: Technics Hi-Fi equipment (vintage aesthetic)  
**Font**: DS-Digital (7-segment LED display font)  
**Icons**: Font Awesome 6.5.1  
**Metadata Library**: jsmediatags 3.9.5

## License

This project is provided as-is for educational and personal use. Technics is a trademark of Panasonic Corporation. This project is not affiliated with or endorsed by Panasonic/Technics.

## Changelog

### Version 1.0 (MKII)

- Initial release with full feature set
- VFD display simulation
- A-B repeat functionality
- Hidden control panel with tone controls
- PWA support with offline capabilities
- MediaSession API integration
- Customizable visual themes
- Peak search function
- Advanced VU metering

## Support

For issues, suggestions, or contributions, please contact the author or submit feedback through the application interface.

-----
<img width="1878" height="805" alt="2" src="https://github.com/user-attachments/assets/194cebcf-6b3b-468f-be95-13d678f80dca" />

**Enjoy your music with vintage style and modern fidelity! 🎵**
