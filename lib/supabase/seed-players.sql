-- ========================================
-- Tryout Tracker — Player Seed Data
-- ========================================

-- U13AA (13 players)
insert into public.players (number, first_name, last_name, previous_team, position, birth_year)
values
  (836, 'Jesse', 'Cote', 'U13AA', 'F', 2013),
  (38, 'Piper', 'Craig', 'U13AA', 'D', 2013),
  (944, 'Daniella', 'Da Silva', 'U13AA', 'G', 2013),
  (44, 'Calle', 'Brewer', 'U13AA', 'D', 2013),
  (639, 'Paige', 'Vandyk', 'U13AA', 'D', 2013),
  (17, 'Tessa', 'Harper', 'U13AA', 'F', 2013),
  (498, 'Taryn', 'Taniguchi', 'U13AA', 'F', 2013),
  (969, 'Lilia', 'Mercer', 'U13AA', 'G', 2013),
  (501, 'Zara', 'Horch', 'U13AA', 'D', 2013),
  (616, 'Charlotte', 'Vandyk', 'U13AA', 'F', 2013),
  (633, 'Sarah', 'Carter', 'U13AA', 'D', 2013),
  (645, 'Ryan', 'Bell', 'U13AA', 'F', 2013),
  (52, 'Sasha', 'Natoli', 'U13AA', 'F', 2013);

-- U13A (10 players)
insert into public.players (number, first_name, last_name, previous_team, position, birth_year)
values
  (338, 'Jayda', 'Arnott', 'U13A', 'D', 2013),
  (426, 'Monica', 'Herriot', 'U13A', 'D', 2013),
  (495, 'Adria', 'McCandie', 'U13A', 'D', 2013),
  (387, 'Beatrice', 'Kennedy', 'U13A', 'F', 2013),
  (500, 'Isla', 'Bechaalani', 'U13A', 'F', 2013),
  (650, 'Mia', 'Henderson', 'U13A', 'F', 2013),
  (673, 'Sophie', 'Majic', 'U13A', 'F', 2013),
  (677, 'Izzy', 'Hurst', 'U13A', 'F', 2013),
  (854, 'Tessa', 'Holmes', 'U13A', 'F', 2013),
  (957, 'Laila', 'Tam', 'U13A', 'G', 2013);

-- U13BB (11 players)
insert into public.players (number, first_name, last_name, previous_team, position, birth_year)
values
  (64, 'Norah', 'Webb', 'U13BB', 'D', 2013),
  (617, 'Yuki', 'Marchese', 'U13BB', 'D', 2013),
  (619, 'Sally', 'Charron', 'U13BB', 'D', 2013),
  (693, 'Zoey', 'Fritsch', 'U13BB', 'D', 2013),
  (605, 'Zara', 'Tasovac', 'U13BB', 'F', 2013),
  (621, 'Carissa', 'Brydges', 'U13BB', 'F', 2013),
  (675, 'Vanessa', 'Weatherdon', 'U13BB', 'F', 2013),
  (747, 'Zahra', 'Hicks', 'U13BB', 'F', 2013),
  (749, 'Sadie', 'Glenns', 'U13BB', 'F', 2013),
  (959, 'Arayana', 'Hicks', 'U13BB', 'G', 2013),
  (968, 'Finley', 'Crabbe', 'U13BB', 'G', 2013);

-- U13B (15 players, #633 Sarah Carter excluded — already in U13AA)
insert into public.players (number, first_name, last_name, previous_team, position, birth_year)
values
  (12, 'Unknown', 'Unknown', 'U13B', null, 2013),
  (47, 'Charlotte', 'Epton', 'U13B', 'D', 2013),
  (107, 'Unknown', 'Unknown', 'U13B', null, 2013),
  (117, 'Emily', 'Xing', 'U13B', 'D', 2013),
  (300, 'Unknown', 'Unknown', 'U13B', null, 2013),
  (378, 'Everly', 'Charbonneau', 'U13B', 'F', 2013),
  (511, 'Unknown', 'Unknown', 'U13B', null, 2013),
  (512, 'MacKenzie', 'Unknown', 'U13B', 'D', 2013),
  (555, 'Unknown', 'Unknown', 'U13B', null, 2013),
  (614, 'Unknown', 'Unknown', 'U13B', null, 2013),
  (622, 'Julia', 'Wood', 'U13B', 'F', 2013),
  (623, 'Unknown', 'Unknown', 'U13B', null, 2013),
  (960, 'Unknown', 'Unknown', 'U13B', null, 2013),
  (964, 'Unknown', 'Unknown', 'U13B', null, 2013);

-- U13C (23 players, #605 Zara Tasovac excluded — already in U13BB)
insert into public.players (number, first_name, last_name, previous_team, position, birth_year)
values
  (5, 'Dawson', 'Ingram', 'U13C', 'F', 2013),
  (13, 'Unknown', 'Unknown', 'U13C', null, 2013),
  (15, 'Unknown', 'Unknown', 'U13C', null, 2013),
  (39, 'Unknown', 'Unknown', 'U13C', null, 2013),
  (43, 'Jayda', 'Oyati', 'U13C', 'F', 2013),
  (51, 'Unknown', 'Unknown', 'U13C', null, 2013),
  (174, 'Unknown', 'Unknown', 'U13C', null, 2013),
  (408, 'Unknown', 'Unknown', 'U13C', null, 2013),
  (490, 'Unknown', 'Unknown', 'U13C', null, 2013),
  (492, 'Unknown', 'Unknown', 'U13C', null, 2013),
  (509, 'Unknown', 'Unknown', 'U13C', null, 2013),
  (513, 'Unknown', 'Unknown', 'U13C', null, 2013),
  (516, 'Unknown', 'Unknown', 'U13C', null, 2013),
  (517, 'Lillian', 'Campbell', 'U13C', 'D', 2013),
  (602, 'Unknown', 'Unknown', 'U13C', null, 2013),
  (632, 'Unknown', 'Unknown', 'U13C', null, 2013),
  (649, 'Unknown', 'Unknown', 'U13C', null, 2013),
  (674, 'Unknown', 'Unknown', 'U13C', null, 2013),
  (686, 'Unknown', 'Unknown', 'U13C', null, 2013),
  (746, 'Unknown', 'Unknown', 'U13C', null, 2013),
  (787, 'Sophia', 'Breukelaar', 'U13C', 'D', 2013),
  (952, 'Unknown', 'Unknown', 'U13C', null, 2013),
  (962, 'Unknown', 'Unknown', 'U13C', null, 2013);

-- ========================================
-- 2012 birth year players
-- ========================================

-- U15A (12 players)
insert into public.players (number, first_name, last_name, previous_team, position, birth_year)
values
  (425, 'Emme', 'Simmons', 'U15A', 'D', 2012),
  (734, 'Maeve', 'Chambers', 'U15A', 'D', 2012),
  (50, 'Kennedy', 'Haffey', 'U15A', 'F', 2012),
  (58, 'McKyla', 'Ruddy', 'U15A', 'F', 2012),
  (494, 'Ryleigh', 'Young', 'U15A', 'F', 2012),
  (552, 'Liberty', 'Sargeant', 'U15A', 'F', 2012),
  (641, 'Reese', 'Douglas', 'U15A', 'F', 2012),
  (655, 'Hailey', 'Ross', 'U15A', 'F', 2012),
  (661, 'Riley', 'Holwell', 'U15A', 'F', 2012),
  (666, 'Maren', 'Ives', 'U15A', 'F', 2012),
  (967, 'Lucy', 'Black', 'U15A', 'G', 2012),
  (997, 'Grace', 'MacGillivray', 'U15A', 'G', 2012);

-- U15BB (8 players)
insert into public.players (number, first_name, last_name, previous_team, position, birth_year)
values
  (767, 'Olivia', 'Karyati', 'U15BB', 'D', 2012),
  (571, 'Eleanor', 'MacEwen', 'U15BB', 'D', 2012),
  (465, 'Juliette', 'Gagne', 'U15BB', 'F', 2012),
  (541, 'Jade', 'Bloye', 'U15BB', 'F', 2012),
  (121, 'Brooke', 'Mooney', 'U15BB', 'F', 2012),
  (676, 'Ella', 'Graham', 'U15BB', 'F', 2012),
  (660, 'Cate', 'McIntyre', 'U15BB', 'F', 2012),
  (935, 'Norah', 'Stott', 'U15BB', 'G', 2012);

-- U15B (17 players)
insert into public.players (number, first_name, last_name, previous_team, position, birth_year)
values
  (965, 'Emily', 'Hughes', 'U15B', 'G', 2012),
  (417, 'Ana', 'Tetzlaff', 'U15B', 'F', 2012),
  (491, 'Arwen', 'Bradford', 'U15B', 'F', 2012),
  (527, 'Norah', 'Kilty', 'U15B', 'F', 2012),
  (569, 'Madilyn', 'Elliott', 'U15B', 'F', 2012),
  (394, 'Violet', 'Huhta', 'U15B', 'D', 2012),
  (540, 'Caela', 'Underhill', 'U15B', 'D', 2012),
  (556, 'Daniela', 'Hango', 'U15B', 'D', 2012),
  (646, 'Lily', 'Noseworthy', 'U15B', 'D', 2012),
  (766, 'Mila', 'Turpin', 'U15B', 'D', 2012),
  (790, 'Samantha', 'Malizia', 'U15B', 'D', 2012),
  (326, 'Unknown', 'Unknown', 'U15B', null, 2012),
  (522, 'Unknown', 'Unknown', 'U15B', null, 2012),
  (523, 'Unknown', 'Unknown', 'U15B', null, 2012),
  (543, 'Unknown', 'Unknown', 'U15B', null, 2012),
  (765, 'Unknown', 'Unknown', 'U15B', null, 2012),
  (946, 'Unknown', 'Unknown', 'U15B', null, 2012);

-- U15C (17 players)
insert into public.players (number, first_name, last_name, previous_team, position, birth_year)
values
  (942, 'Eva', 'Montigny', 'U15C', 'G', 2012),
  (572, 'Elisabeth', 'Laperriere', 'U15C', 'F', 2012),
  (202, 'Alexandra', 'Launiere', 'U15C', 'D', 2012),
  (708, 'Katherine', 'Jones', 'U15C', 'D', 2012),
  (710, 'Anamaria', 'Tsagaris', 'U15C', 'D', 2012),
  (106, 'Unknown', 'Unknown', 'U15C', null, 2012),
  (176, 'Unknown', 'Unknown', 'U15C', null, 2012),
  (289, 'Unknown', 'Unknown', 'U15C', null, 2012),
  (415, 'Unknown', 'Unknown', 'U15C', null, 2012),
  (477, 'Unknown', 'Unknown', 'U15C', null, 2012),
  (530, 'Unknown', 'Unknown', 'U15C', null, 2012),
  (531, 'Unknown', 'Unknown', 'U15C', null, 2012),
  (539, 'Unknown', 'Unknown', 'U15C', null, 2012),
  (785, 'Unknown', 'Unknown', 'U15C', null, 2012),
  (786, 'Unknown', 'Unknown', 'U15C', null, 2012),
  (826, 'Unknown', 'Unknown', 'U15C', null, 2012),
  (932, 'Unknown', 'Unknown', 'U15C', null, 2012);
