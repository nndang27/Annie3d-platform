# Translating Annie 3D

This guide is for anyone translating `src/messages/<code>.ts`, whether a person or a model.
English (`src/messages/en/*.ts`) is the source. Each catalog is typed as `Catalog`: exactly the
English keys, each with a string, or with a plural object where English has one.

## What the product is

Annie 3D is a canvas workspace that turns product photos into 3D ads. People place **nodes** on
a **board** and connect them with wires:
- a product photo becomes a 3D model;
- the model is placed in a staged scene;
- the scene renders still images and ad videos;
- the results are exported or previewed in a simulated shop page or social feed.

Each generation step is a **run**, and runs cost **credits**.

## Terms (use one translation per term, everywhere)

| English | Meaning here | Not |
| --- | --- | --- |
| board | the canvas document a person works on (like a Figma file or a Miro board) | a plank, a committee |
| node | a box on the board that does one step | a network node |
| wire / connection | the link from one node's output to another's input | electric wire |
| run (verb, noun) | generating a node's result | running (sport), a series |
| credits | the unit runs are paid with | bank credit, film credits |
| Stage (node) | a 3D scene set for the product: light, backdrop, props (a photo studio set) | a phase, a theatre stage |
| Packshot | a clean product still image, as in product photography | a pack of shots |
| Ad video | a short advertising video | |
| Export | the node that packages files for download | foreign trade |
| Simulation | a live preview of the ad inside a mock shop page, feed or showroom | a physics simulation |
| Starter / template | a ready-made board layout to begin from | |
| preset | a named set of settings (a look, a motion, a GLB target) | |
| look / motion | a Stage's visual style / an Ad video's camera movement | |
| version | one saved result of a node (v1, v2) | a software release |
| Annie | the assistant's name: never translate | |

## Rules

- Keep every `{placeholder}` exactly as written. Move it to wherever your grammar wants it.
- **Plurals.** A plural object lists the CLDR forms your language uses:
  - vi, ko, ja, zh: `other` only;
  - fr, pt, es, it: `one`, `many`, `other`;
  - ru: `one`, `few`, `many`, `other`.
  - `i18n.test.ts` checks the forms against `Intl.PluralRules`.
- **Keep literal**: Annie, Annie 3D, the plan names Creator and Studio ("Free" is translated), GLB, MP4, PNG, ZIP, TikTok, Google Merchant, Google Swirl,
  keyboard symbols (⌘ ⌥ ⇧ ⌫), px, fps, ms, and the version letter in "v{n}".
- **Byte units** follow your language's software: Mo/Ko/Go in French, МБ/КБ/ГБ in Russian,
  MB/KB/GB elsewhere.
- **Style.**
  - Short and plain, as in good native software (Apple, Figma, Canva in your language).
  - Buttons are short verbs.
  - Sentence case where your script has case. No exclamation marks.
  - Use native punctuation and quotes (« » in French, 「」 in Japanese, full-width punctuation in
    Chinese and Japanese).
- **Address.** Match the target language's usual software register:

  | Language | Address |
  | --- | --- |
  | vi | "bạn" |
  | fr | "vous" |
  | pt (Brazil) | "você" |
  | es | "tú" |
  | it | "tu" |
  | ru | "вы" (lowercase) |
  | ko | polite 해요체 in sentences, noun phrases on buttons |
  | ja | です/ます in sentences, noun phrases on buttons |
  | zh (Simplified) | "你" |

- **Length.** UI space is tight. Aim for no more than about 130% of the English length on
  buttons, menu items and labels.
- **Legal text** (site legal pages): translate faithfully and do not add or drop obligations.
- **`sameAsEnglish`.** When the correct translation is the English text (a loanword, a name),
  add the key to the file's exported `sameAsEnglish` list. The test rejects any other English
  text left in the file.
