# Demo photos

Put JPEG or PNG photos you have permission to use in the matching worker folder:

```
seed-assets/ebou-ceesay/profile.jpg
seed-assets/ebou-ceesay/portfolio-cupboard.jpg
seed-assets/ebou-ceesay/portfolio-door.png
```

Folder names: `lamin-jallow`, `ebou-ceesay`, `ousman-darboe`, `fatou-sowe`,
`modou-bah`, `alieu-touray`, `binta-sanneh`, `mariama-joof`, `bakary-sanyang`,
`isatou-jatta`.

Use `profile.jpg`, `profile.jpeg` or `profile.png` and `portfolio-<name>.jpg/png`.
Maximum 5 MiB per file. These folders are ignored by Git. Do not add real identity documents.
Missing photos are fine: the app shows initials. Run `npm run seed:demo` again
after adding photos. It adds missing profile photos and new portfolio images without
replacing a profile photo already selected in the app. Photos pass through the existing
validated upload service and authenticated Cloudinary storage; no public URL shortcuts.

Verification fixtures use a generated image explicitly marked **DEMO ONLY**, not these
photos or anyone's identity documents. Nine fixture workers are marked approved solely
for testing and one is pending. They are fictional demo accounts, not verified people.
