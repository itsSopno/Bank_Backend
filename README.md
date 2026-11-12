datascope-backend/
│
├── src/
│   ├── server.ts                        # Express অ্যাপ লিসেন ও পোর্ট বাইন্ডিং
│   ├── app.ts                           # CORS, JSON Parser, Helmet, Routes মাউন্টিং
│   │
│   ├── config/                          # পরিবেশ ভ্যারিয়েবল ও Redis/DB কনফিগ
│   │   └── env.ts
│   │
│   ├── db/                              # Drizzle ORM ডেটাবেজ লেয়ার
│   │   ├── index.ts                     # Postgres Pool
│   │   └── schema.ts                    # সব টেবিল স্কিমা
│   │
│   ├── controllers/                     # রিকোয়েস্ট গ্রহণ ও রেসপন্স সেন্ডিং (HTTP Layer)
│   │   ├── records.controller.ts
│   │   ├── datasets.controller.ts
│   │   ├── analytics.controller.ts
│   │   └── saved-views.controller.ts
│   │
│   ├── services/                        # বিজনেস লজিক ও ডেটাবেজ কুয়েরি লেয়ার
│   │   ├── records.service.ts           # Dynamic WHERE clause, FTS & Sorting logic
│   │   ├── analytics.service.ts         # SQL Aggregations
│   │   └── export.service.ts            # CSV Stream processing
│   │
│   ├── routes/                          # এন্ডপয়েন্ট ডেফিনেশন
│   │   ├── records.routes.ts            # router.post('/search', searchRecords)
│   │   ├── datasets.routes.ts
│   │   ├── analytics.routes.ts
│   │   └── index.ts                     # সেন্ট্রাল রাউটার মাউন্টিং
│   │
│   ├── middlewares/                     # অথেন্টিকেশন ও এরর হ্যান্ডলার
│   │   ├── auth.middleware.ts           # JWT ভেরিফিকেশন
│   │   ├── rbac.middleware.ts           # requireRole(['admin', 'analyst'])
│   │   └── error.middleware.ts          # সেন্ট্রাল এরর হ্যান্ডলার
│   │
│   └── validators/                      # Zod দিয়ে রিকোয়েস্ট বডি ভ্যালিডেশন
│       └── record-search.schema.ts
│
├── scripts/
│   └── seed.ts                          # ১০০,০০০ রেকর্ড সিডার
├── package.json
└── tsconfig.json

// বর্তমানে আছে:
baseUrl: "/api"

// আলাদা ব্যাকএন্ড হলে (যেমন: Express/NestJS localhost:5000 এ চললে):
baseUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"

