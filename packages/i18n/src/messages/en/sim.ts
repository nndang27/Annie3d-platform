/**
 * The simulator (SimulatorOverlay), the phone remote at /sim/<room> (Controller) and the mock
 * places the product is shown in. Place names are `simEnv.*` (contracts.ts).
 */
export default {
  // What each place is (tab tooltip).
  'sim.envHint.shop': 'Product page of an online store',
  'sim.envHint.tiktok': 'Vertical social feed with a shop card',
  'sim.envHint.sticker': 'Chat sticker with a transparent background',
  'sim.envHint.showroom': 'Live stage you steer from your phone',
  /** Title when nothing names the product (no headline, no custom label). */
  'sim.product.default': 'Your product',

  // Overlay header
  'sim.dialog.label': 'Simulator',
  'sim.head.environments': 'Environment',
  'sim.head.spin': 'Spin',
  'sim.head.stopSpin': 'Stop spin',
  'sim.head.download': 'Download PNG',
  'sim.head.close': 'Close simulator',
  'sim.stage.empty': 'Wire a 3D model into this node to see it here.',
  'sim.stage.loading': 'Loading 3D…',
  'sim.toast.loadFailed': 'Could not load the 3D model: {message}',

  // Shop page mock-up
  'sim.shop.brand': 'BRAND',
  'sim.shop.navNew': 'New',
  'sim.shop.navShop': 'Shop',
  'sim.shop.navAbout': 'About',
  'sim.shop.crumb': 'Home / New arrivals',
  'sim.shop.rating': { one: '{rating} ({count} review)', other: '{rating} ({count} reviews)' },
  'sim.shop.description': 'Drag to turn it around. What you see is the real 3D product.',
  'sim.shop.addToCart': 'Add to cart',
  'sim.shop.freeShipping': 'Free shipping over $50',
  'sim.shop.returns': '30-day returns',

  // TikTok feed mock-up
  'sim.tiktok.following': 'Following',
  'sim.tiktok.forYou': 'For You',
  'sim.tiktok.share': 'Share',
  'sim.tiktok.handle': '@yourbrand',
  'sim.tiktok.tags': '#fyp #tiktokshop #newin',

  // Chat sticker mock-up
  'sim.sticker.msgAsk': 'did you see the new drop?? 👀',
  'sim.sticker.msgSend': 'sending you the sticker',
  'sim.sticker.msgReply': 'omg want 😍',
  'sim.sticker.note':
    'The sticker is the live view with a transparent background: turn it, then download the PNG.',

  // Showroom: phone pairing panel
  'sim.showroom.title': 'Phone remote',
  'sim.showroom.help':
    'Scan with your phone, then tilt it: the product follows. Two-way: the phone sees what this screen shows.',
  /** `{command}` is the command name `pnpm share`. */
  'sim.showroom.localhost':
    'Phones cannot open localhost. Open this board through the {command} link to pair a phone.',
  'sim.showroom.phones': { one: '{count} phone connected', other: '{count} phones connected' },
  'sim.showroom.waiting': 'Waiting for a phone',
  'sim.showroom.pose': 'α {alpha}°, β {beta}°, γ {gamma}°',

  // Shared by the overlay and the phone remote
  'sim.status.connecting': 'Connecting…',
  'sim.action.recenter': 'Recenter',

  // Phone remote page (/sim/<room>)
  'sim.remote.title': 'Annie 3D Remote',
  'sim.remote.connected': 'Connected',
  'sim.remote.waitingScreen': 'Waiting for the screen',
  'sim.remote.product': 'Product',
  'sim.remote.startMotion': 'Start motion control',
  'sim.remote.tilt': 'Tilt your phone to turn it',
  'sim.remote.motionDenied': 'Motion access was refused. Use the pad below.',
  'sim.remote.motionUnsupported': 'This device has no motion sensor. Use the pad.',
  'sim.remote.padLabel': 'Drag to turn the product',
  'sim.remote.pad': 'Drag here to turn',
  'sim.remote.spin': 'Spin',
  'sim.remote.stop': 'Stop',
  'sim.remote.snapshot': 'Snapshot',
  'sim.remote.places': 'Place',
  'sim.remote.snapshotAlt': 'Snapshot from the screen',
} as const;
