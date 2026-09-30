"""Demo logins (BACKEND_CONTRACT.md v1.3 section 7b, "Demo accounts").

No auth: these are demo-only keys for seeded data that are already in the repo (DECISIONS.md #6).
Never returns isClient or billingTier.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import select

import constants as C
from db import Brand, get_db
from schemas import DemoAccountsOut

router = APIRouter(prefix="/auth", tags=["Brand accounts"])


@router.get("/demo-accounts", response_model=DemoAccountsOut)
def demo_accounts(db=Depends(get_db)):
    names = {b.brand_id: b.name for b in db.scalars(select(Brand)).all()}
    return {"accounts": [{"brandId": a["brandId"], "brandName": names[a["brandId"]], "role": a["role"],
                          "apiKey": a["apiKey"]} for a in C.DEMO_ACCOUNTS if a["brandId"] in names]}
