#!/usr/bin/env python3
"""Write sin_categories.csv: MAS large category for every SIN in sin_profile.csv.

Each SIN gets a source tag:
  site      listed on the category pages at gsa.federalschedules.com/industries (FEDSched)
  inferred  assigned from the SIN's scope, its base SIN, or GSA program knowledge
  fallback  mapped from the SSQ+ governmentwide category; check before relying on it

Edit SITE / INFERRED below and rerun, then rerun `vehicle_map.py rank`.
"""

import csv
import os
from pathlib import Path

HERE = Path(__file__).resolve().parent
WORK = Path(os.environ.get("MASMAP_DIR", HERE))

OM, FAC, FUR, HC = "Office Management", "Facilities", "Furniture and Furnishings", "Human Capital"
IND, IT, MISC, PS = "Industrial Products and Services", "Information Technology", "Miscellaneous", "Professional Services"
SCI, SP, TL, TRV = "Scientific Management and Solutions", "Security and Protection", "Transportation and Logistics Services", "Travel"

SITE = {
    IT: "54151ECOM 33411 532420L 811212 54151HACS 54151HEAL 54151S 511210 54151 518210C 518210FM 541370GEO "
        "541519CSP 541519ICAM 541519PIV 541519PKI 561422 611420 517312 517410",
    PS: "541611 561450 541620 562112 562910REM 562910RMI 522310 531210 541211 541214 541219 541990IPS 541990RISK "
        "541930 611630 541110 541614 541614SVC 512110 541430 541511 541613 541810 541820 541910 561920 541810ODC "
        "541330EMI 541330ENG 541370GIS 541420 541690 541715 541715AIR 541715APM 541990 611430",
    SCI: "333999 333314 333415 334513 334515 334516 334519ENV 339113LAB 532490L 339112 339113R 532490ESA 611430TTS "
         "334511 541380",
    SP: "334290 334290L 334290PACS 561612 336413 332216 611430ST",
    OM: "811212SA 339940",
    FUR: "33721 33721P 541614CF 337121P 337127P",
    FAC: "561210FAC",
    HC: "611430TD 541612LOB",
    TL: "532111 481211B 492110 336211",
    TRV: "561599L",
    IND: "332510 332510C 333112 532310",
}

INFERRED = {
    IT: "13251 33411BP 511210BP 54151ECOMBP 811212BP",
    IND: "4PL 332510CBP 333TOOL 811310MR 333921 334519",
    PS: "541990IPSBP 541690E",
    HC: "541612HC 333318TDTM 611512 611710 56131",
    OM: "339940OS4 561110 518210DC 518210ERM 493110RM 541611LIT 541990L 532420LC 561439 333316C 333241 333415REM",
    FUR: "337121H 339113H 337127 337127INT",
    FAC: "332311P 33512 335220D 238160 561730 324191 332999BMS 332999P 333415HVAC 325611 325998W",
    SP: "24654 24652 238910",
    TL: "481211O 531 336991 3361V 3361 335999 336212 532120 485 541614OR 561499M",
    TRV: "531110 561599",
    MISC: "511120 339920S 339950",
}

GW_TO_MAS = {
    "IT": IT, "Professional Services": PS, "Facilities & Construction": FAC, "Office Management": OM,
    "Security and Protection": SP, "Transportation and Logistics Services": TL, "Travel & Lodging": TRV,
    "Human Capital": HC, "Industrial Products & Services": IND, "Medical": SCI,
    "Clothing, Textiles & Subsistence S&E": MISC, "Sustainment S&E": MISC, "Miscellaneous S&E": MISC,
    "Electronic & Communication Equipment": MISC, "Equipment Related Services": IND,
    "Research and Development": PS,
}


def main():
    lookup = {}
    for src, table in (("site", SITE), ("inferred", INFERRED)):
        for cat, sins in table.items():
            for s in sins.split():
                lookup.setdefault(s, (cat, src))
    rows = []
    for r in csv.DictReader(open(WORK / "sin_profile.csv")):
        sin = r["sin"]
        if sin in lookup:
            cat, src = lookup[sin]
        elif sin.endswith("BP") and sin[:-2] in lookup:
            cat, src = lookup[sin[:-2]][0], "inferred"  # BPA-specific SIN follows its base SIN
        else:
            cat, src = GW_TO_MAS.get(r["gw_category"], "Unassigned"), "fallback"
        rows.append({"sin": sin, "category": cat, "source": src, "gw_category": r["gw_category"],
                     "total_sales": r["total_sales"]})
    with open(WORK / "sin_categories.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    tot = sum(float(r["total_sales"]) for r in rows) or 1
    for src in ("site", "inferred", "fallback"):
        v = sum(float(r["total_sales"]) for r in rows if r["source"] == src)
        print(f"{src:9} {sum(1 for r in rows if r['source'] == src):4} SINs  {v / tot:6.1%} of sales")


if __name__ == "__main__":
    main()
