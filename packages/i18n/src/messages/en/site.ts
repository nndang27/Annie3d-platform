/**
 * The static site (apps/site: /home, /legal/*) and the public share page the Worker renders
 * (/s/<token>). "Annie 3D" is a brand and stays as it is in every language.
 */
export default {
  // Every page
  'site.meta.pageTitle': '{title} · Annie 3D',
  'site.nav.skipToContent': 'Skip to content',
  'site.nav.homeLabel': 'Annie 3D home',
  'site.nav.openCanvas': 'Open the canvas',
  'site.nav.footer': 'Footer',
  'site.nav.canvas': 'Canvas',
  'site.nav.privacy': 'Privacy',
  'site.nav.terms': 'Terms',
  'site.nav.contact': 'Contact',
  'site.nav.languages': 'Languages',
  'site.footer.copyright': '© 2026 Annie 3D, Australia.',

  // /home
  'site.home.title': '3D product ads from one photo',
  'site.home.description':
    'Annie 3D turns one product photo into a true 3D model, ad videos, packshots at any angle and an animated GLB, on a canvas you can open without signing up.',
  'site.home.eyebrow': '3D advertising workspace',
  'site.home.headline': 'One product photo in. A 3D ad out.',
  'site.home.lead':
    'Drop a product photo on the canvas. Annie 3D builds the product as a real 3D model, then gives you an ad video, packshots from any angle, an animated GLB for your store and a link anyone can open. Because every output comes from the same model, your product looks exactly right in all of them.',
  'site.home.whatEyebrow': 'What you get',
  'site.home.whatTitle': 'Everything from one model',
  'site.home.videosTitle': 'Ad videos',
  'site.home.videosBody':
    'Teardown reveals for tech, stone and water for jewelry, splash heroes for beauty, in 1:1, 4:5 and 9:16.',
  'site.home.packshotsTitle': 'Packshots at any angle',
  'site.home.packshotsBody': 'Frame the camera yourself or take four standard angles.',
  'site.home.glbTitle': 'Animated GLB',
  'site.home.glbBody': 'Checked against web, Google Merchant and Google Swirl limits before you download.',
  'site.home.howEyebrow': 'How it works',
  'site.home.howTitle': 'A canvas of nodes you can rewire',
  'site.home.howBody':
    'Start from a ready-made graph or add your own nodes: photo, text, 3D model, stage, packshot, ad video and export. Select a region on the model and describe the change; every edit becomes a new version you can compare or undo.',
  'site.home.tryExample': 'Try the example board',

  // /legal/*
  'site.legal.draft': 'Draft for the pre-release · to be reviewed by counsel before launch',
  'site.legal.translationNotice':
    'This translation is provided for convenience. If it differs from the English version, the English version applies.',
  'site.legal.readEnglish': 'Read the English version',

  'site.terms.title': 'Terms of use',
  'site.terms.description': 'Terms for using Annie 3D.',
  'site.terms.contentTitle': 'Your content',
  'site.terms.contentBody':
    'You keep the rights to the photos you upload and the outputs you create. Only upload products you have the right to advertise.',
  'site.terms.useTitle': 'Acceptable use',
  'site.terms.useBody':
    'Do not use Annie 3D to create counterfeit product ads, to impersonate brands or people, or to produce unlawful content.',
  'site.terms.creditsTitle': 'Credits',
  'site.terms.creditsBody':
    'Runs use credits. A run that fails our quality checks is refunded automatically.',
  'site.terms.preReleaseTitle': 'Pre-release',
  'site.terms.preReleaseBody':
    'Features may change. We will announce changes that affect your data before they take effect.',

  'site.privacy.title': 'Privacy notice',
  'site.privacy.description': 'How Annie 3D handles your data.',
  'site.privacy.whoTitle': 'Who we are',
  'site.privacy.whoBody': 'Annie 3D is operated from Australia. Contact: {email}.',
  'site.privacy.storeTitle': 'What we store',
  'site.privacy.storeBody':
    'Your Google account name, email address and profile picture when you sign in; the boards, nodes, prompts and versions you create; files you upload and files we generate for you; run history and credit transactions.',
  'site.privacy.whereTitle': 'Where it is stored',
  'site.privacy.whereBody':
    "Account and board data in a Postgres database hosted by Neon in Sydney, Australia. Files in Cloudflare R2 object storage in the Oceania region. Pages are delivered through Cloudflare's network.",
  'site.privacy.cookiesTitle': 'Cookies',
  'site.privacy.cookiesBody':
    'One first-party session cookie keeps you signed in, and one first-party cookie remembers the language you pick. We do not use advertising cookies.',
  'site.privacy.sharingTitle': 'Sharing',
  'site.privacy.sharingBody':
    'Nothing is public unless you create a share link. You can revoke a link at any time.',
  'site.privacy.deleteTitle': 'Deleting your data',
  'site.privacy.deleteBody':
    'Delete boards from the canvas, or email us to delete your account and all files.',

  // Public share page rendered by the Worker (/s/<token>)
  'share.unavailableTitle': 'Link not available',
  'share.unavailableHeading': 'This link is not available',
  'share.unavailableBody': 'It may have been revoked by its owner.',
  'share.openApp': 'Open Annie 3D',
  'share.makeYours': 'Make yours free',
  'share.description': '{owner} made this with Annie 3D: 3D product ads from one photo.',
  'share.by': 'by {owner}',
  'share.modelAlt': '3D model preview',
  'share.modelTitle': '3D model',
  'share.triangles': { one: '{count} triangle', other: '{count} triangles' },
  'share.megabytes': '{size} MB',
  'share.downloadGlb': 'Download GLB',
  'share.madeWith': 'Made with {brand}',
  'share.terms': 'Terms',
} as const;
