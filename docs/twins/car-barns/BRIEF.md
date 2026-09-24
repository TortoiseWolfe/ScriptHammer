# Chattanooga Car Barns (1886-87): modelling brief, October 1978

**Building:** the 1886-87 Chattanooga Street Railroad Co. stable and car barn at the SW corner of Market and W 3rd (301 Market St; county parcel 135MA A 001, 302 Broad St). It is the south building of NRHP #79002436. **Architect unknown**: R.H. Hunt designed the 1906-07 buildings north of W 3rd, not this one.
**Issue:** #1290 (epic #1289). **Twin slot it replaces:** Warehouse `300-market-street` (#714).
**Target state:** October 1978, when CARTA had just moved out (NRHP: "Vacated in 1978 by [CARTA]"). This is the state in Garnet Chapin's eight NRHP photos. The era is still an owner decision in #1290; October 1978 is the recommendation.
**Measured shell:** [massing_spec.json](massing_spec.json) (USGS 3DEP LiDAR, April 2025). Where this brief and the spec disagree on a number, **the spec wins**: it was measured, while this brief's heights are read from profiles.
**Compiled** 2026-09-23 by a research pass, then checked by an independent adversarial pass that re-opened every photo, plan and Sanborn sheet. That pass corrected 15 of 20 detail claims, and the corrected values are the ones printed here.

**Evidence archive.** `R/` below means the research archive on the owner's machine: `C:\Users\JonPo\Downloads\SketchUpMake2017\reference\chatt-historic-rebuild-2026-09-23\research\`. It holds the NRHP PDFs and extracted photos, the Sanborn sheets and crops, the LiDAR tiles and clips, and the scripts that measured them. Everything in it can be re-fetched from the URLs cited here.

**Licence:** the 1978 photos and the 1975 plan are third-party work (Franklin Assoc. / Landmarks Chattanooga). **Measure from them; never use them as textures.** The 2010 Commons photo is CC BY-SA 3.0, likewise measurement only. See the licence rules in [../chatt-historic-rebuild.md](../chatt-historic-rebuild.md).

---

## 0. Six things that change how you model it

1. **The roof structure is not from 1886.** The 1901 Sanborn reads "Roof supported on 6 rows of wood posts" (`R/carbarns-history/sanborn/1901_0003_carhouse_full.jpg`). By 1917 the sheet reads "Fire proof constrn. except exposed steel frame. Brick walls. Concrete floors and roof" (`1917_0010_repair_full.jpg`). The two rows of steel columns and the concrete roof slab the NRHP describes therefore date from 1901-1917 (_inferred_). The 1978 target has the steel and concrete version.
2. **The end-wall "pediments" are raised flat parapets, not triangles.** B25 LiDAR shows a level central parapet at 10.0 m, framed by taller piers, with lower stepped ends and scroll (ogee) shoulders. Details are in §5.
3. **The typed photo captions give the direction the camera faces, not where it stands.** For example, "View from Southwest" on photo 3 is a view looking SW at the Market facade. The companion NRHP 80003806 photo card uses the same convention and says so explicitly: "Camera Facing: Northwest" (`R/carbarns-history/photos/e80003806-2.png`).
4. **The hand annotations on the 1975 plan swap the dates.** The plan writes "1906" inside the south building and "1886" on the north office strip (`R/carbarns-synth/crops/plan_hand_south.jpg`, `plan_hand_north.jpg`). Five other sources put 1886 south of 3rd: the nomination text, photo captions 7 and 8 ("1886 structure"), NRHP 80003806 (Hunt, 1907, north of 3rd), the 1889 Sanborn (railway stables at 301 Market) and the column grid. Treat the annotation as a slip.
5. **Door positions come from two independent sources that agree within about 3 ft.** One is the 1975 plan's entrance arrows. The other is a projective fit of photos 3 and 6. See §4.
6. **Demolition:** it began in July 2025. No source says it is finished, and no source says any facade was kept. See §11.

---

## 1. Which photo shows which building

The NRHP 79002436 photos are Garnet Chapin's, dated October 1978 (https://npgallery.nps.gov/NRHP/GetAsset/NRHP/79002436_photos). On disk they are `R/carbarns-history/photos/photo1-8.png`, the clean page scans `R/adv-check-carbarns-geo/p5-05.jpg` (photo 3) and `p11-11.jpg` (photo 6), and the contact sheet with captions `R/adv-check-carbarns-geo/photos/sheet.jpg`.

| #   | Typed caption                                                                | What it actually shows                                                                                                                                                                                                                                             | Building                                                                                                                                       |
| --- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | View from northeast                                                          | Looking north up Market St from about W 3rd. Stepped gables with round lights, open bays on brick piers. At left foreground is a brick end with an arched window: the 1886 barn's NE end (corrected by the adversarial pass). A Firestone sign is in the distance. | Mostly the **1906-07 Hunt** complex, but the left **foreground is the 1886 barn's Market NE end**: the only close 1978 view of its NE openings |
| 2   | View from northwest                                                          | Looking NW across the Market / 3rd intersection at the Hunt barn's Market elevation: 5 stepped gables with round lights, open bays, a CARTA bus. At left is the hip-roofed 1906 office end with a MARKET street sign.                                              | **Hunt**                                                                                                                                       |
| 3   | View from Southwest                                                          | Looking SW from the Market / 3rd corner at the **Market (east) facade**, with 4 sectional car doors and a FOR SALE billboard. The **north (W 3rd) elevation** recedes in shade at right.                                                                           | **1886 barn**                                                                                                                                  |
| 4   | View from northwest                                                          | The 1906 Hunt office facade on W 3rd: one storey, with a two-storey centre of three arched windows and a tile roof. It was demolished between 1979 and 2008 (round 1).                                                                                             | **Hunt office** (gone)                                                                                                                         |
| 5   | View from northwest                                                          | Looking NW from the bus yard (lot 2) at the **SW corner**: the east end of the 1955 bus-wash wing (a large open bay), its south face with steel sash, the barn's south wall with an arched window and a door, and the **tall square chimney**.                     | **1886 barn**                                                                                                                                  |
| 6   | View from northeast. Handwritten: "ALL STRUCTURES - BROAD ST. LOOKING NORTH" | Looking N up Broad at the **Broad (west) facade** (4 car doors), the **chimney**, the **wash wing** at the south end, and the south wall above it. The Hunt barn's gables show in the far distance.                                                                | **1886 barn** (and Hunt, far)                                                                                                                  |
| 7   | Roofline of 1886 Structure / "Skyline element 1886 structure"                | Looking up at an end-wall corner: corner pier, scroll-capped stub pier, blind round arch with a double header ring, corbelled string courses, and a lamp bracket on the corner. SE or NW corner: not settled. Whichever you choose, use it consistently.           | **1886 barn**                                                                                                                                  |
| 8   | Interior of 1886 structure                                                   | The open hall: two rows of slender steel columns, deep transverse beams, rectangular skylights, pendant lamps and unit heaters, a concrete floor with painted lines, and overhead doors in the far end wall.                                                       | **1886 barn**                                                                                                                                  |

Other images on disk:

- `R/carbarns-history/photos/e80003806-1.png`: Steve Leach, September 1978, camera facing NW. The Hunt office from Market & 3rd.
- `R/carbarns-history/commons/ChattanoogaCarBarns_2010_orig.jpg`: Andrew Jameson, 2010-04-17, CC BY-SA 3.0 (https://commons.wikimedia.org/wiki/File:ChattanoogaCarBarns.jpg). This is the **1886 barn** in its Sportsbarn phase, showing the **Market facade and the full north elevation in colour**. It is the best source for colour, window rhythm and the parapet silhouette.
- `R/carbarns-history/loc/habs_tn206_*.jpg`: HABS TN-206, the D.S. Etheridge showroom at 329 Market (https://www.loc.gov/item/tn0073/). It is a block-mate, not the car barn.

---

## 2. Footprint, placement, grade

- **Size:** 200 ft E-W (along W 3rd) by 110 ft N-S (NRHP text, `R/carbarns-history/nrhp_79002436_text.txt`). The assessor sketch agrees at 110x200, with the main floor 20 ft and the basement 10 ft (`R/carbarns-geo/assessor_photos/assessor_card_135MA_A_001_img0.jpg`). B25 LiDAR gives 61.0-61.5 x 33.0-33.5 m (round-1 adversarial verdicts).
- **Corners** (axis-aligned; LiDAR-traced B25 2025-04, `R/carbarns-geo/lidar_traced_1886_carbarn.json`): lon -85.3104894 to -85.3098138, lat 35.0531361 to 35.0534374. Centre is 35.053287, -85.310152.
  - **Do not use** the inline `footprints[0].lonLat` in the round-1 geodata dossier. It sits 66 m south, on the 1997 office.
- **Rotation: measured, 1.45° ± 0.2° counter-clockwise from true east.** The W 3rd face bears 88.55°, and the 2015 and 2011 flights agree. Model axis-aligned; true north is 1.45° clockwise from the green axis, and the twin's `yawDeg` is +1.45 ([massing_spec.json](massing_spec.json) `rotation`).
- **Grade:** flat. Ground around all four sides is 205.95-206.11 m NAVD88. All heights below are above that sidewalk datum of about 206.03 m.
- **Basement:** full basement under the whole footprint, 10 ft high (NRHP; assessor).
- **SketchUp frame** used in this brief: origin at the outer **SW corner**, **+x east** along W 3rd (0-200 ft), **+y north** (0-110 ft), **z** up from the sidewalk.

## 3. Heights

The source for most rows is B25 LiDAR, `R/carbarns-synth/lidar_end_wall_profiles.json` and `crops/lidar_end_wall_profiles.png`. Round 1 showed that the 2011, 2015 and 2025 roofs match, so these heights hold back to at least 2011. Parapets are brick and unchanged since 1978 (_inferred_).

| Element                                        | m                               | ft          | Source                                                                      |
| ---------------------------------------------- | ------------------------------- | ----------- | --------------------------------------------------------------------------- |
| Roof deck at the north edge                    | 7.3                             | 24          | LiDAR                                                                       |
| Roof deck at the south edge                    | 7.9                             | 26          | LiDAR. It falls about 0.6 m to the north; NRHP: "slight slope to the north" |
| North (W 3rd) wall top                         | 7.2-7.3                         | 24          | LiDAR. Essentially flush with the roof, with a simple coping                |
| South wall top (open west part)                | 8.2-8.7                         | 27-28.5     | LiDAR, x -73..-61                                                           |
| End walls: raised central parapet              | 10.0                            | 33          | LiDAR, both ends                                                            |
| End walls: tall piers flanking the raised part | Market 10.7, Broad 10.3         | 35 / 34     | LiDAR                                                                       |
| End walls: low end sections                    | 9.0                             | 29.5        | LiDAR                                                                       |
| End walls: stub piers and corner piers         | 9.5-10.1                        | 31-33       | LiDAR                                                                       |
| Chimney top                                    | 13.0-13.6                       | 43-44.5     | LiDAR; photo 6 gives about 13 m                                             |
| Car door openings                              | 12 ft wide x 16 ft high nominal |             | NRHP. Photo 3 measures 12.0-12.3 ft wide, and D3 about 15.9 ft high         |
| Lintel course over the doors                   | about 4.9                       | about 16    | NRHP "directly above"; photo 3                                              |
| Corbelled round-arch course                    | about 5.5-6.0                   | about 18-20 | NRHP "some two feet above"; photo 3 estimate                                |
| Ground floor, clear                            |                                 | 20          | Assessor "FA H=20"                                                          |
| Basement, clear                                |                                 | 10          | Assessor "BMD H=10"                                                         |
| Bus-wash wing top                              | about 4.9-5.3                   | about 16-17 | Photo 6 estimate (_inferred_)                                               |

## 4. Elevations

### East: Market St (110 ft)

Sources are photo 3 (`p5-05.jpg`, `photos/photo3_facade_left.png`, `photo3_facade_right.png`), the 2010 Commons photo, the 1975 plan and LiDAR.

- **Doors:** 4 sectional overhead car doors in 12 ft by 16 ft openings. D1 and D3 have a multi-pane transom over a shorter door leaf; D2 and D4 are full-height leaves. Centres are measured from the **SE corner**:

  | Door | Photo fit | Plan arrow | Use    | Width                                                                                              |
  | ---- | --------- | ---------- | ------ | -------------------------------------------------------------------------------------------------- |
  | D1   | 13.6 ft   | 13.2       | **13** | 12                                                                                                 |
  | D2   | 30.4      | 27.6       | **29** | 12                                                                                                 |
  | D3   | 54.5      | 52.8       | **54** | 12                                                                                                 |
  | D4   | 76.7      | 74.8       | **76** | about **14.5** wide × about 14.5 ft high. Its head sits about 1.5-2 ft below the D1-D3 lintel line |

- **Other openings, from the SE corner:**
  - a narrow arched window, about 3.5 ft wide, at 2-5.5 ft;
  - a 3 ft man-door at about 63-66 ft;
  - a door-like rectangular window about 4 ft wide × 9 ft tall, sill about 2 ft, under a projecting hood, at about 96-98 ft (the NE office);
  - a tall arched window about 4 ft wide × 8.5-9 ft, at about 104-108 ft. Its sill is about 6 ft up and its head about 14-15 ft up: the same family as the north windows.
- **Courses** (NRHP): a lintel course directly above the doors. About 2 ft higher, a corbelled course "imitative of round-arch lintels" (a small corbel-arch frieze). Two plain string courses above that.
- **Pilasters:** pilaster strips rise from the corbel course into the two tall piers (2010 photo).
- **Blind round arches:** in each end bay, high up near the corners, with a double ring of headers (photo 7; 2010 photo near the NE and SE corners).
- **Parapet, S to N** (LiDAR east band, 0.5 m bins; 2010 photo). It is symmetric:
  1. SE corner pier, about 2 ft wide, about 9.5-9.7 m.
  2. Short shoulder, about 5 ft, 9.2-9.5 m, capped with an ogee scroll.
  3. Stub pier, about 2 ft, 9.6 m. The corner and stub piers have stepped, corbelled inner edges under stone caps; the ogee curve belongs to the shoulder between them.
  4. Low section, about 9 ft, 9.0 m.
  5. Scroll ramp up to a **tall pier**, about 4 ft wide, 10.7 m. Its centre is about **22 ft from the corner**.
  6. **Raised flat central parapet**, about 60-66 ft long, 10.0 m, stone coping.
  7. Tall pier, centre about 88 ft (22 ft from the NE corner).
  8. Scroll, low section 9.0 m, stub pier 9.7-9.8 m, shoulder, **NE corner pier** 9.8 m.
- **Props for 1978:** the FOR SALE billboard on a steel frame between the north tall pier and D4 ("THIS PRIME COMMERCIAL PROPERTY / 2.25 ACRES INCLUDING BUILDINGS / CALL 629-14..").

### West: Broad St (110 ft, plus the wash wing at its south end)

Sources are photo 6 (`R/adv-check-carbarns-geo/photos/native-009.jpg`, zoom crop `R/carbarns-synth/crops/p6_broad_zoom.jpg`), the 1975 plan and LiDAR.

- **Doors:** 4 car doors about 11-12 ft wide. Centres are measured from the **SW corner of the barn**, not of the wing:

  | Door | Photo fit | Plan arrow | Use    |
  | ---- | --------- | ---------- | ------ |
  | Da   | 32.8 ft   | 30.8       | **32** |
  | Db   | 56.6      | 56.3       | **56** |
  | Dc   | 79.8      | 79.2       | **80** |
  | Dd   | 94.3      | 96.5       | **95** |

- **South end openings, from the SW corner:**
  - a tall rectangular window, about 5-6 ft wide, at about 3-9 ft;
  - a narrow tall window, about 4 ft, at about 14-18 ft;
  - a round-arched man-door, about 4 ft, at about 20-24 ft.
- **Courses and pilasters:** the same as Market.
- **Parapet:** the same composition as Market (LiDAR west band). The tall piers are lower, at about 10.3 m, and sit at about y -39 and -18.5 local. The raised central section is 10.0 m, the low sections 9.0 m, and the corner piers 9.5-9.8 m.
- **The chimney** rises just inside the south end (see §6).
- **The wash wing's west face** runs flush with this elevation, south of the barn: about 16-18 ft wide, with one large open vehicle bay about 12-13 ft high (photo 6; plan entrance arrow over the wing).

### North: W 3rd St (200 ft)

The 2010 Commons photo is the main source (crop `R/carbarns-synth/crops/commons_north_elev.jpg`). Photo 3 shows the same face in 1978, in shade at the right. The NRHP text and the 1975 plan also contribute.

- **Rhythm:** 10 bays of 20 ft. A roof-drain downspout sits on each of the 9 interior column lines ("Roof drains disrupt the window alignment of the north elevation roughly in line with the interior columns", NRHP). A projective fit of the 2010 photo places the downspouts at about 21, 41, 61, 81, 101 ... ft from the NE corner, confirming 20-ft centres.
- **Windows:** two tall, narrow arched windows per bay, about 3.5-4 ft wide (_inferred_) by about 8.5 ft. They have cut limestone sills at about 5.5-6 ft above the sidewalk and arched heads of brick rowlocks (NRHP: "cut limestone sills and arched lintels composed of rows of brick"). By 2010 several were bricked in or boarded. In 1978 they were glazed sash (photo 3 shows open arched windows at right).
- **NE end bay (office):** the same two tall arched windows as every other bay in 1978. An earlier reading of "lower, larger windows" was refuted.
- **Doors:**
  - a door to the basement stair at about 92-100 ft from Broad (1975 plan: entrance arrow and "DN TO BASEMENT");
  - a man-door about 3 ft wide at about 172-175 ft from Broad (25-28 ft from the NE corner), set under an arched window opening.
- **Parapet:** none to speak of. A flat wall top with coping at 7.2-7.3 m. The higher end parapets show above it at each end.

### South (200 ft; faced the bus yard in 1978)

Sources are photos 5 and 6, the 1975 plan (employee parking against this wall) and the 1917-1955 Sanborns ("Car Yards", "Bus Yard").

- **West ~52 ft:** covered at ground level by the 1955 bus-wash wing. The brick wall above the wing is blank (photo 6).
- **Man-door:** at about 54-58 ft from Broad, just east of the wing. It shows as a gap in the plan's south wall and as the arched-head door in photo 5.
- **Windows:** tall arched windows like the north ones. **Use the 8 positions drawn on the 1975 plan** between about 65 and 186 ft from Broad. Only the door and the first window east of it are confirmed by a photo (photo 5).
- **Parapet:** a flat top with coping at about 8.4 m, about 0.5 m above the roof edge.
- **Flues:** the thin stacks seen above this wall in photo 6 are the wing's flues. They are fixed to the outside of the barn wall and rise about 1-2 m above its coping, and they are the same objects as the junction flue in §8: model them once.

## 5. Roof

- **Form:** essentially flat. A poured concrete slab on transverse beams, falling about 0.6 m from south (7.9 m) to north (7.3 m), about 1:55. It drains to the north-wall downspouts (NRHP; LiDAR).
- **Finish:** a dark built-up roof. It is black in the 2008-2024 county orthos (`R/carbarns-geo/imagery/hamco_2008.jpg`). The 1978 finish is _inferred_ to be similar.
- **Skylights:** wire-glass skylights. The 1917 sheet draws 15 "W.G." squares: 4 across E-W at about 30, 72, 110 and 151 ft from Broad, in two rows over each 40-ft side aisle (about 18 and 36 ft from the N wall, and about 25 and 41 ft from the S wall). This is schematic. The 1950 sheet says "FULL OF W.G. SKYLTS". Photo 8 shows rectangular skylights between the beams, size unknown; about 5x8 ft is a guess (_inferred_).
- **Elevator penthouse:** the NRHP mentions a "c. 1905" elevator with a roof penthouse. The 1917 and 1950 Sanborns put the freight elevator ("FE") on the W 3rd wall at about 99-110 ft from Broad. The 1975 plan puts the elevator and stair there too. No 1978 photo shows a penthouse, and the 2025 roof is flat there. Model it as an optional low brick box over the shaft only if a source appears.

## 6. Structure (column grid)

- **Columns** (1975 plan hi-res, `R/carbarns-synth/crops/plan1886_hi.jpg`; NRHP): two rows of slender steel columns built up from angles, **9 per row**.
  - Rows at **y = 42.6 ft and 67.2 ft** from the outer face of the south wall, i.e. bays of about 42.6 / 24.6 / 42.8 ft. The NRHP gives the clear spans as "40' x 24', and 40'".
  - Columns at **x = 21.4 + 19.6k ft** (k = 0 to 8) from the outer face of the Broad wall, so both end bays are about 21.5 ft. This also fits the 2010 downspouts at 21/41/61/81/101 ft from the NE corner.
- **Beams:** a deep transverse beam on each column line, spanning N-S between the walls and resting on the two columns (photo 8). The Sanborns call the frame "exposed steel". The beams look deep (about 2-3 ft, _inferred_).
- **Floors:** concrete ground floor over the basement.
- **Walls:** load-bearing brick. The 1889 Sanborn prints 12" and 16" (wall thickness, _inferred_), and the 1917 and 1950 sheets print "16" along the long walls. Use about 16 in.
- **Sanborn "22'" on the end walls:** probably a height in feet; the LiDAR roof there is 24-26 ft. Unresolved.

## 7. Materials and colour (1978)

- **Brick:** local red brick (NRHP). The 2010 colour photo shows orange-red common brick with light mortar and old paint ghosts. The 1978 B&W photos read as unpainted, and the Market face looks pale only because it is in sun (_inferred_).
- **Stone:** cut limestone sills (NRHP). Light grey stone or concrete caps on the piers and scroll copings (photo 7; 2010).
- **Arches:** window heads in rowlock brick.
- **Car doors:** sectional panel doors with one glazed row (photo 3). Their colour is unknown; mid-grey in B&W. The originals were "large wooden overhead doors" (NRHP).
- **Wash wing:** a different wall material from the barn. The 1955 Sanborn colours it olive, not pink, and photo 6 shows paler coursing, so brick or concrete block (_inferred_). It has industrial steel pivot sash.

## 8. SW chimney and the 1955 bus-wash wing

- **Chimney:** tall, square, brick, with a slight corbelled cap (photos 5 and 6).
  - Size about **2 x 2 m** (6.5 ft); top at about **13.0-13.6 m** above the sidewalk.
  - **Position:** built into the Broad (west) wall, **3.8-5.7 m north of the SW corner**, with its centre about 1.5 m east of the Broad face and 4.75 m north of the south face ([massing_spec.json](massing_spec.json) `chimney`). Top 219.44 m NAVD88, 13.6 m above the SW-corner grade. The 1975 plan draws it a little further south, and the LiDAR wins.
  - The same corner is marked "Black Sm." in 1917 and "Heater Rm Bst" in 1950/55, so it is probably the forge or boiler flue (_inferred_).
  - It stood in both 1978 and 2025.
- **Bus-wash wing (1953 per Sanborn; NRHP says 1955):** brick walls, concrete floor and roof, fireproof (Sanborn). one storey, flat roof, attached to the **south** face at the **Broad** end, with its west face flush with the Broad elevation.
  - **Size** from three sources: NRHP "14' x 52'"; 1975 plan 17.6 x 52.8 ft outside (labelled "STEAM"); 1955 Sanborn about 18 x 50 ("BUS WASHING"). Use **about 16 ft N-S x 52 ft E-W**, about 16 ft high.
  - **Openings:** a drive-through vehicle bay at each end, facing Broad (photo 6) and facing east into the yard (photo 5). Three large steel industrial windows on the south face (photo 6).
  - **Other:** a metal flue pipe at the junction with the barn (photo 5).
  - **Later:** it is not on the April 1950 sheet but is on the 1955 sheet. It appears gone by the 2008 ortho, probably removed around the 1997 office (_inferred_).

## 9. Interior (October 1978)

The 1975 plan (`R/adv-check-carbarns-geo/nom-9.jpg`, `nomhi-9.jpg`; Selmon T. Franklin Associates, Exhibit A sheet 1-A, dated 12/29/75) and photo 8 are the sources.

- **Main hall:** one open "REPAIR SHOP" floor, 20 ft clear, with a concrete floor and the column grid in §6.
- **Inspection pits:** two, each about 3 ft wide by about 85 ft long. They run E-W from about 106 to about 192 ft from Broad, one in the south aisle (about 30 ft from the S wall) and one in the centre aisle (about 55 ft). Both line up with Market doors D2 and D3.
- **Rooms and stairs:**
  - an **OFFICE** room of about 22 x 24 ft at the NE corner;
  - a **stair to the basement plus the elevator** on the N wall, about 92-110 ft from Broad;
  - a small interior stair "DN" beside the south column row, about 36-41 ft from Broad.
- **Fittings:** unit heaters, pendant lights and skylights (photo 8).
- **Basement:** full, 10 ft. The 1950 Sanborn shows a concrete underground passage under W 3rd St from the FE position to the north block. Do not model it for the twin.
- **Condition:** empty in October 1978 (photo 8: debris, a crate).

## 10. Do not model for 1978 (later volumes and changes)

- **Sportsbarn era, early 1980s-2023:** car doors infilled with storefronts, green awnings, "The Sports Barn" letters, and bump-outs of about 2 m on Market (2010 photo; county building layer).
- **1997 office on lot 2**, built against the south wall east of about x -59 m. In 2025 it hides most of the south elevation. The twin's baked office overlaps the barn by 4-5.6 m (round-1 verdict).
- **Removal of the wash wing** before 2008 (_inferred_).
- **North of 3rd:** the 1906 office and the 1926 garage were gone by 2008 (round 1).
- **B25 LiDAR (2025) differences from 1978:** no wing, and altered openings. Parapets, roof and chimney are the same.

## 11. Demolition status (as of 2026-09-23)

- **Started July 2025.** "Drury Development began demolition of the former Car Barn in July" (TFP, 2025-09-18, https://www.timesfreepress.com/news/2025/sep/18/historic-chattanooga-building-partially-collapses/).
- **Partial collapse on 2025-09-18** (same article; it does not say which wall).
- **About half down by 2025-09-25:** "half of that building is already demolished" (NewsChannel 9, https://newschannel9.com/newsletter-daily/chattanooga-community-divided-over-historic-car-barn-being-demolished-replaced-by-hotel).
- **Facades:**
  - Preserve Chattanooga asked Drury "that the facades on Market and Broad Street be preserved and incorporated into the new hotel design". Drury "has remained silent and unwilling to discuss an alternative approach", and said it is "working to use some of the building material where possible" (Chattanoogan, 2025-07-16, https://www.chattanoogan.com/2025/7/16/506070/Work-To-Start-On-8-Story-Drury-Hotel.aspx).
  - A July 2025 headline, "Wrecking ball: Efforts now underway to preserve portion of Chattanooga's historic Car Barn", appears in a Bing News RSS result. The article text could not be fetched.
  - NewsChannel 9 says preservation societies "worked to keep some of the original structure intact", with no specifics.
- **Map evidence:** OSM changeset 179588685 (2026-03-09, source "local knowledge") removed the building strip, and W 3rd is tagged highway=construction.
- **Most recent mention:** on 2026-09-15 a city councilman said "The Car Barn is being torn down for a Drury Hotel" (Chattanoogan, https://www.chattanoogan.com/2026/9/15/523400/Chattanooga-City-Hall-Is-At-Top-Of-List.aspx). This is rhetoric, not a site report.
- **Verdict:** completion is **probable but unconfirmed**. **No source confirms any retained facade**, so treat both facades as lost (_inferred_). A site photo would settle it. Web search budget was exhausted in this session, so later news may exist.

## 12. The standing 1906-07 Hunt barn (north of W 3rd)

R.H. Hunt's 1907 five-bay trolley barn at 211-241 Market still stands (NRHP 80003806, listed 1980-02-29). It has 15 tracks under five parallel E-W roofs, and brick bearing walls. Stepped gables with circular lights face both Market and Broad; the corrugated-metal gable roofs are concealed behind them (NRHP 79002436; NRHP inventory form `R/carbarns-geo/nrhp_80003806_nomination.txt`). Its 1906 office on 3rd St and the 1926 garage are gone, and parking has occupied their sites since at least 2008. Mast General Store bought the Market-side parcel (221 Market) in March 2025 for a spring-2027 opening; 224 Broad is owned by Broad Street Land Co. (round 1, assessor). It can still be photographed and measured from life before the renovation.

## 13. Sanborn sheets

Sheet numbers are taken from the LoC file IDs. The printed number was confirmed on the 1889, 1901, 1917 v1 s10 and 1950 s10 sheets. LoC item pages: https://www.loc.gov/item/sanborn08291_0NN/

| Edition (LoC item)                             | Sheet          | Viewer URL                                                       | Shows                                                                                                                                                                                                                 | File                             |
| ---------------------------------------------- | -------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Jan 1885 (\_001)                               | 21 (block 105) | https://www.loc.gov/resource/g3964cm.g3964cm_g082911885/?sp=21   | Before construction: shanties on Broad, small buildings near Market                                                                                                                                                   | `sanborn/1885_0021.jpg`          |
| 1889 (\_002)                                   | 3 (block 28)   | https://www.loc.gov/resource/g3964cm.g3964cm_g082911889/?sp=4    | "Chattanooga Street Railway Stables" (Broad half, marked with the stable X) + "Car House" (Market half); Office at the NE; ELEV mid-building; "2 & B."; walls 12"/16"; about 110x205 ft                               | `1889_0003.jpg`, `_carbarn_full` |
| 1901 (\_003)                                   | 3 (block 3)    | https://www.loc.gov/resource/g3964cm.g3964cm_g082911901/?sp=6    | "Chattanooga Electric Railway, Roof supported on 6 rows of wood posts"; Office "1-2" at the NE                                                                                                                        | `1901_0003.jpg`                  |
| 1917 Vol 1 (\_004)                             | **10**         | https://www.loc.gov/resource/g3964cm.g3964cm_g08291191701/?sp=14 | "CR&L Co. Car Repair Shops. Fire proof constrn. except exposed steel frame. Brick walls. Concrete floors and roof"; W.G. skylights; blacksmith at the SW; car yards (18 cars) to the south                            | `1917_0010*.jpg`                 |
| 1917 Vol 1 (\_004)                             | 1              | .../g08291191701/?sp=5                                           | The Hunt barn (75 cars, skylights, concrete slab roof)                                                                                                                                                                | `1917_0001*.jpg`                 |
| 1917-Apr 1950 Vol 1 (\_010; LoC dates it 1951) | **10**         | https://www.loc.gov/resource/g3964cm.g3964cm_g08291195001/?sp=17 | "Southern Coach Lines Inc Bus Repair Shops. Exposed steel fr. conc. fls & rf. Full of W.G. skylts"; AS (sprinklers) throughout; Heater Rm at the SW; FE and underground passage at 3rd St; Bus Yard; no wash wing yet | `1950_0010*.jpg`                 |
| 1917 republished 1955 Vol 1 (\_015)            | **10**         | https://www.loc.gov/resource/g3964cm.g3964cm_g08291195501/?sp=17 | The same, plus a **"BUS WASHING"** annex at the SW (south side, Broad end)                                                                                                                                            | `1955_0010.jpg`                  |

- **1929-31:** LoC holds only Vols 2-5 of that edition (\_006 "Revised 1929 Vol. 2", \_007 1930 Vol 3, \_008 1930 Vol 4, \_009 1931 Vol 5). There is **no 1929-31 Vol 1**. The downtown stayed in the 1917 Vol 1, corrected by pasted slips, so there is no separate 1929-31 sheet for this block (_inferred_ from `R/carbarns-history/sanborn/item_006-009.json`).
- **1951 and 1955:** both exist and are listed above.
- **Jan 1922 (\_022):** 3 sheets, not digitised. Coverage unknown.

## 14. Timeline

- **1885-01:** the site is mostly vacant.
- **1886-06-15:** purchase announced; building work 1886-87.
- **1889:** Sanborn shows stables and car house.
- **1901:** wood-post roof.
- **c.1905:** elevator and penthouse (NRHP). This is a different lift from the 1889 hoist, and the west half of the south wall probably dates from 1901-17 (_inferred_).
- **1901-1917:** steel frame and concrete roof (_inferred_).
- **1906-07:** the Hunt office and barn are built north of 3rd.
- **1925-26:** buses arrive (TEPCO); the garage is built.
- **1941:** Southern Coach Lines takes over.
- **1955:** the bus wash is added.
- **1970s:** CARTA.
- **1975-12-29:** Franklin plan drawn.
- **1978:** CARTA leaves; photos taken in October.
- **1979-07-09:** NRHP listing.
- **Early 1980s:** the Sportsbarn opens.
- **1997:** office built on lot 2.
- **2023:** Drury buys the lot on 2023-02-22; the Sportsbarn closes.
- **2025-04-08/09:** LiDAR flown.
- **2025-07:** demolition begins.
- **2025-09-18:** partial collapse.
- **2025-09-25:** about half down.
- **2026-03-09:** OSM removes the building.

## 15. Conflicts and open questions

1. **Plan dates swapped.** The 1975 plan annotation reverses 1886 and 1906; resolved in favour of the text (§0).
2. **North and south window count and sizes in 1978** come from the 2010 photo and the plan. A 1970s photo of the W 3rd side is needed.
3. **Elevator penthouse.** Whether it existed in 1978, and its size, is unknown.
4. **Colours** of the doors, trim and wing are unknown (B&W only). Possible sources: CARTA, the Chattanooga Public Library, or the Chattanooga News-Free Press of 3 Mar and 27 Dec 1978 (NRHP bibliography).
5. **Wash-wing size:** 14x52 (NRHP), 17.6x52.8 (plan) or about 18x50 (Sanborn). The material is also uncertain.
6. **Photo 7 corner:** SE or NW, unresolved.
7. **1889 "2 & B." and 1901 "1B=2B":** it is unclear whether there was a second floor or loft, or a different grade, before 1901.
8. **Demolition completion and facade retention** are unconfirmed.
9. **Rotation** is measured (1.45°). The twin's baked 1997 office (OSM way 66418285) runs 4.3-4.8 m into the footprint along 43 m of the south wall; clip it when the model ships.
10. **Skylights:** count and size are schematic only.

## 16. Crops made for this brief

All under `R/carbarns-synth/crops/`:

- `plan1886_hi.jpg`: 1975 plan of the south building.
- `p3_ruler.jpg`, `p3_vertical.jpg`: photo 3 with pixel rulers.
- `p6_broad_zoom.jpg`: Broad facade from photo 6.
- `commons_north_elev.jpg`, `commons_market_elev.jpg`, `commons_parapet.jpg`: crops of the 2010 photo.
- `s1955_carbarn.jpg`: the 1955 Sanborn.
- `lidar_end_wall_profiles.png` (data in `../lidar_end_wall_profiles.json`): parapet silhouettes.
- `plan_hand_*.jpg`: the swapped date annotations.
