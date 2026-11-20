# NS-01 — reconciliação das declarações SQL S22 (sem Supabase)

**Marco:** 20/11/2026 | **Escopo:** S22→staging 001–010 | **Estado:** INVENTÁRIO CONFERIDO / NO-GO produção

A reconciliação classifica **cada declaração histórica**; não representa 100% do comportamento executável, conclusão de funcionalidades ou permissão para implantar SQL.

| Categoria | Declarações S22 | Nomes históricos únicos | Nomes candidatos únicos | Situação por declaração |
|---|---:|---:|---:|---|
| functions | 58 | 50 | 18 | CONTRACT_SUCCESSOR_REVIEW: **7**, SAME_NAME_CANDIDATE_PRESENT: **11**, UNPORTED: **40** |
| triggers | 26 | 23 | 22 | CONTRACT_SUCCESSOR_REVIEW: **1**, SAME_NAME_CANDIDATE_PRESENT: **8**, UNPORTED: **17** |
| views | 18 | 18 | 16 | DEFERRED_DEPENDENCY: **2**, VIEW_CANDIDATE_PRESENT: **16** |
| policies | 80 | 80 | 21 | NARROWER_OWNER_POLICY_CANDIDATE: **13**, SECURITY_REVIEW_REQUIRED: **67** |

**Base auditada:** 30 migrations com SHA-256 verificado; 10 candidatos SQL com SHA-256 registrado; 182 declarações originais rastreadas por arquivo, linha e hash.

## Pendências priorizadas (não omitidas)

### functions
- `ops.current_area` — **UNPORTED**; fonte `001_schemas_roles.sql:78`; SHA `f7d26399bec0`; risco: LEGACY_AUTH_GUC_OR_ROLE
- `ops.current_request_id` — **UNPORTED**; fonte `001_schemas_roles.sql:83`; SHA `e29f2f00425e`; risco: sem indicação estática
- `ops.is_staff` — **UNPORTED**; fonte `001_schemas_roles.sql:88`; SHA `3fd54460655f`; risco: ANSWER_OR_PRIVILEGED_FLOW
- `learning.grade_answer` — **CONTRACT_SUCCESSOR_REVIEW** → `canone_ops.exam_answer`; fonte `006_learning_items.sql:68`; SHA `8ec345c4f955`; risco: SECURITY_DEFINER_SOURCE, ANSWER_OR_PRIVILEGED_FLOW
- `editorial.enforce_verification_on_publish` — **UNPORTED**; fonte `011_triggers_integridade.sql:1`; SHA `1a9aba6f429b`; risco: sem indicação estática
- `norms.expire_verifications_on_new_version` — **UNPORTED**; fonte `011_triggers_integridade.sql:77`; SHA `332b8e7e1200`; risco: sem indicação estática
- `learning.enforce_single_correct_option` — **UNPORTED**; fonte `011_triggers_integridade.sql:137`; SHA `b0fb84e0ce1e`; risco: ANSWER_OR_PRIVILEGED_FLOW
- `learning.require_correct_option_to_publish` — **UNPORTED**; fonte `011_triggers_integridade.sql:160`; SHA `0553497f9ed9`; risco: ANSWER_OR_PRIVILEGED_FLOW
- `editorial.sync_learning_projection` — **UNPORTED**; fonte `011_triggers_integridade.sql:218`; SHA `34b7a7a516d1`; risco: sem indicação estática
- `editorial.enforce_state_transition` — **UNPORTED**; fonte `011_triggers_integridade.sql:308`; SHA `2a4f09f7a9e7`; risco: LEGACY_AUTH_GUC_OR_ROLE
- `admin.expire_support_grants` — **UNPORTED**; fonte `011_triggers_integridade.sql:411`; SHA `a7b7d3339e3b`; risco: sem indicação estática
- `admin.purge_expired_grants` — **UNPORTED**; fonte `011_triggers_integridade.sql:444`; SHA `bc818b2cc6fb`; risco: sem indicação estática
- `learning.derive_grade` — **UNPORTED**; fonte `012_srs_engine.sql:1`; SHA `f94a64fcbdf8`; risco: ANSWER_OR_PRIVILEGED_FLOW
- `learning.replay_event` — **UNPORTED**; fonte `012_srs_engine.sql:50`; SHA `955d15b4d650`; risco: sem indicação estática
- `learning.apply_review_event` — **CONTRACT_SUCCESSOR_REVIEW** → `canone_ops.exam_to_srs`; fonte `012_srs_engine.sql:164`; SHA `cff14ef2a526`; risco: sem indicação estática
- `learning.refresh_mastery` — **UNPORTED**; fonte `012_srs_engine.sql:196`; SHA `48afb72ea913`; risco: sem indicação estática
- `learning.due_items` — **UNPORTED**; fonte `012_srs_engine.sql:257`; SHA `251fd36f2712`; risco: sem indicação estática
- `learning.rebuild_user_state` — **UNPORTED**; fonte `012_srs_engine.sql:282`; SHA `b0fc86df43f3`; risco: sem indicação estática
- `admin.read_user_progress_as` — **UNPORTED**; fonte `014_rls.sql:180`; SHA `9b67de5fd045`; risco: SECURITY_DEFINER_SOURCE
- `learning.vigente_answer_key` — **UNPORTED**; fonte `018_provas_gabarito.sql:194`; SHA `6a2a0bc42524`; risco: ANSWER_OR_PRIVILEGED_FLOW
- `learning.set_item_correct` — **UNPORTED**; fonte `018_provas_gabarito.sql:220`; SHA `b51ac1725597`; risco: ANSWER_OR_PRIVILEGED_FLOW
- `learning.apply_answer_key` — **UNPORTED**; fonte `018_provas_gabarito.sql:241`; SHA `1e07e61cb312`; risco: ANSWER_OR_PRIVILEGED_FLOW
- `learning.clear_item_correct` — **UNPORTED**; fonte `018_provas_gabarito.sql:259`; SHA `40f7904cf721`; risco: ANSWER_OR_PRIVILEGED_FLOW
- `learning.check_answer_key_entry` — **UNPORTED**; fonte `018_provas_gabarito.sql:288`; SHA `afe3bfcf9611`; risco: ANSWER_OR_PRIVILEGED_FLOW
- `learning.project_answer_key_entry` — **UNPORTED**; fonte `018_provas_gabarito.sql:347`; SHA `ab3237aa77e2`; risco: ANSWER_OR_PRIVILEGED_FLOW
- `learning.assert_answer_key_complete` — **UNPORTED**; fonte `018_provas_gabarito.sql:377`; SHA `3ad888582752`; risco: ANSWER_OR_PRIVILEGED_FLOW
- `learning.trg_assert_answer_key_complete` — **UNPORTED**; fonte `018_provas_gabarito.sql:434`; SHA `b9f35afa14b1`; risco: ANSWER_OR_PRIVILEGED_FLOW
- `learning.trg_assert_answer_key_entry_complete` — **UNPORTED**; fonte `018_provas_gabarito.sql:445`; SHA `5547b3149054`; risco: ANSWER_OR_PRIVILEGED_FLOW
- `learning.check_answer_key_lineage` — **UNPORTED**; fonte `018_provas_gabarito.sql:463`; SHA `486f3683f7fd`; risco: ANSWER_OR_PRIVILEGED_FLOW
- `learning.check_exam_track_numbers` — **UNPORTED**; fonte `018_provas_gabarito.sql:493`; SHA `1123b5cec293`; risco: sem indicação estática
- `learning.grade_answer` — **CONTRACT_SUCCESSOR_REVIEW** → `canone_ops.exam_answer`; fonte `018_provas_gabarito.sql:536`; SHA `01019b2757a8`; risco: SECURITY_DEFINER_SOURCE, ANSWER_OR_PRIVILEGED_FLOW
- `editorial.sync_learning_projection` — **UNPORTED**; fonte `018_provas_gabarito.sql:563`; SHA `2ce97e10ff3c`; risco: sem indicação estática
- `learning.start_exam_attempt` — **CONTRACT_SUCCESSOR_REVIEW** → `canone_ops.exam_start`; fonte `019_tentativa_ingestao.sql:82`; SHA `aa29ab290664`; risco: SECURITY_DEFINER_SOURCE, LEGACY_AUTH_GUC_OR_ROLE
- `learning.answer_exam_attempt` — **CONTRACT_SUCCESSOR_REVIEW** → `canone_ops.exam_answer`; fonte `019_tentativa_ingestao.sql:108`; SHA `9799cc200267`; risco: SECURITY_DEFINER_SOURCE, LEGACY_AUTH_GUC_OR_ROLE
- `learning.finish_exam_attempt` — **CONTRACT_SUCCESSOR_REVIEW** → `canone_ops.exam_finish`; fonte `019_tentativa_ingestao.sql:169`; SHA `a7cfca49bb72`; risco: SECURITY_DEFINER_SOURCE, LEGACY_AUTH_GUC_OR_ROLE
- `learning.reveal_exam_key` — **CONTRACT_SUCCESSOR_REVIEW** → `canone_ops.exam_reveal`; fonte `019_tentativa_ingestao.sql:193`; SHA `7ce5ba9a5256`; risco: SECURITY_DEFINER_SOURCE, LEGACY_AUTH_GUC_OR_ROLE, ANSWER_OR_PRIVILEGED_FLOW
- `ops.import_corpus_form` — **UNPORTED**; fonte `019_tentativa_ingestao.sql:251`; SHA `ca3dc9f58c4d`; risco: SECURITY_DEFINER_SOURCE, ANSWER_OR_PRIVILEGED_FLOW
- `learning.reconcile_item_correct` — **UNPORTED**; fonte `021_letra_derivada.sql:1`; SHA `0c403f100088`; risco: SECURITY_DEFINER_SOURCE, ANSWER_OR_PRIVILEGED_FLOW
- `learning.reconcile_item_correct` — **UNPORTED**; fonte `022_prova_selada_letra_inteira.sql:46`; SHA `8aebbead5d95`; risco: SECURITY_DEFINER_SOURCE, ANSWER_OR_PRIVILEGED_FLOW
- `ops.current_role` — **UNPORTED**; fonte `023_tres_fechos_do_qa.sql:1`; SHA `b9bc584fb104`; risco: sem indicação estática
- `ops.is_staff` — **UNPORTED**; fonte `023_tres_fechos_do_qa.sql:75`; SHA `b512f5fe9ee7`; risco: ANSWER_OR_PRIVILEGED_FLOW
- `learning.enforce_single_correct_option` — **UNPORTED**; fonte `023_tres_fechos_do_qa.sql:83`; SHA `3232a383f38d`; risco: ANSWER_OR_PRIVILEGED_FLOW
- `ops.import_corpus_form` — **UNPORTED**; fonte `023_tres_fechos_do_qa.sql:123`; SHA `84eff4035751`; risco: SECURITY_DEFINER_SOURCE, ANSWER_OR_PRIVILEGED_FLOW
- `ops.schema_sem_usage` — **UNPORTED**; fonte `025_identity_usage.sql:41`; SHA `f65b0486d44f`; risco: sem indicação estática
- `learning.check_answer_key_entry` — **UNPORTED**; fonte `026_staff_le_gabarito_default_zero.sql:58`; SHA `5e19e12f8349`; risco: SECURITY_DEFINER_SOURCE, ANSWER_OR_PRIVILEGED_FLOW
- `learning.project_answer_key_entry` — **UNPORTED**; fonte `026_staff_le_gabarito_default_zero.sql:110`; SHA `289049363c4d`; risco: SECURITY_DEFINER_SOURCE, ANSWER_OR_PRIVILEGED_FLOW
- `ops.system_reach` — **UNPORTED**; fonte `027_papel_de_sistema.sql:123`; SHA `fd2638e07267`; risco: sem indicação estática

### triggers
- `trg_audit_hash` — **CONTRACT_SUCCESSOR_REVIEW** → `trg_audit_chain_insert`; fonte `009_admin_governance.sql:93`; SHA `9ff18af6ede3`; risco: sem indicação estática
- `trg_publish_requires_verification` — **UNPORTED**; fonte `011_triggers_integridade.sql:73`; SHA `6b05ad215e51`; risco: sem indicação estática
- `trg_new_norm_version_expires` — **UNPORTED**; fonte `011_triggers_integridade.sql:133`; SHA `c818176f41a4`; risco: sem indicação estática
- `trg_single_correct_option` — **UNPORTED**; fonte `011_triggers_integridade.sql:156`; SHA `e166f8749bcd`; risco: sem indicação estática
- `trg_require_correct_option` — **UNPORTED**; fonte `011_triggers_integridade.sql:214`; SHA `2516611687b2`; risco: sem indicação estática
- `trg_sync_learning_projection` — **UNPORTED**; fonte `011_triggers_integridade.sql:304`; SHA `13dcdbe24d93`; risco: sem indicação estática
- `trg_state_transition` — **UNPORTED**; fonte `011_triggers_integridade.sql:377`; SHA `8a71fe696d8b`; risco: sem indicação estática
- `trg_expire_support_grants` — **UNPORTED**; fonte `011_triggers_integridade.sql:437`; SHA `718b4436b936`; risco: sem indicação estática
- `trg_check_answer_key_entry` — **UNPORTED**; fonte `018_provas_gabarito.sql:343`; SHA `cb2b01169a7c`; risco: sem indicação estática
- `trg_project_answer_key_entry` — **UNPORTED**; fonte `018_provas_gabarito.sql:373`; SHA `01fc5962cdd2`; risco: sem indicação estática
- `trg_answer_key_completo` — **UNPORTED**; fonte `018_provas_gabarito.sql:453`; SHA `debfb5175bb7`; risco: sem indicação estática
- `trg_answer_key_entry_completo` — **UNPORTED**; fonte `018_provas_gabarito.sql:458`; SHA `75bf2ccc9223`; risco: sem indicação estática
- `trg_answer_key_lineage` — **UNPORTED**; fonte `018_provas_gabarito.sql:489`; SHA `2ef3ff305578`; risco: sem indicação estática
- `trg_exam_track_numbers` — **UNPORTED**; fonte `018_provas_gabarito.sql:524`; SHA `7e3cd229ebcb`; risco: sem indicação estática
- `trg_reconcile_item_correct` — **UNPORTED**; fonte `021_letra_derivada.sql:86`; SHA `6a0c3085ed9f`; risco: sem indicação estática
- `trg_reconcile_item_correct` — **UNPORTED**; fonte `022_prova_selada_letra_inteira.sql:120`; SHA `975737dec567`; risco: sem indicação estática
- `trg_single_correct_option` — **UNPORTED**; fonte `023_tres_fechos_do_qa.sql:108`; SHA `e166f8749bcd`; risco: sem indicação estática
- `trg_reconcile_item_correct` — **UNPORTED**; fonte `023_tres_fechos_do_qa.sql:118`; SHA `b7f7ab0d7d4f`; risco: sem indicação estática

### views
- `subscriber.v_my_due` — **DEFERRED_DEPENDENCY**; fonte `013_views.sql:94`; SHA `80147de37955`; risco: sem indicação estática
- `admin.v_user_overview` — **DEFERRED_DEPENDENCY**; fonte `013_views.sql:131`; SHA `2afcb871fa7d`; risco: ADMIN_VIEW

### policies
- `pub_read_plan` — **SECURITY_REVIEW_REQUIRED**; fonte `014_rls.sql:36`; SHA `690286291203`; risco: sem indicação estática
- `pub_read_subject` — **SECURITY_REVIEW_REQUIRED**; fonte `014_rls.sql:44`; SHA `951582bdeb41`; risco: sem indicação estática
- `pub_read_subtopic` — **SECURITY_REVIEW_REQUIRED**; fonte `014_rls.sql:47`; SHA `38fc0cb073af`; risco: sem indicação estática
- `pub_read_module` — **SECURITY_REVIEW_REQUIRED**; fonte `014_rls.sql:50`; SHA `9c0ae01c1043`; risco: sem indicação estática
- `pub_read_content` — **SECURITY_REVIEW_REQUIRED**; fonte `014_rls.sql:53`; SHA `a6458415a279`; risco: sem indicação estática
- `pub_read_content_version` — **SECURITY_REVIEW_REQUIRED**; fonte `014_rls.sql:59`; SHA `a087ff5895f6`; risco: sem indicação estática
- `pub_read_relation` — **SECURITY_REVIEW_REQUIRED**; fonte `014_rls.sql:62`; SHA `76b6460333e9`; risco: sem indicação estática
- `pub_read_norm` — **SECURITY_REVIEW_REQUIRED**; fonte `014_rls.sql:65`; SHA `b20abf99f8f2`; risco: sem indicação estática
- `pub_read_norm_version` — **SECURITY_REVIEW_REQUIRED**; fonte `014_rls.sql:67`; SHA `42f7170cc57f`; risco: sem indicação estática
- `pub_read_norm_item` — **SECURITY_REVIEW_REQUIRED**; fonte `014_rls.sql:68`; SHA `24792f4077c2`; risco: sem indicação estática
- `pub_read_source` — **SECURITY_REVIEW_REQUIRED**; fonte `014_rls.sql:69`; SHA `20821bc73dd2`; risco: sem indicação estática
- `pub_read_learning_item` — **SECURITY_REVIEW_REQUIRED**; fonte `014_rls.sql:70`; SHA `4672d4b8f7e1`; risco: sem indicação estática
- `sub_own_profile` — **SECURITY_REVIEW_REQUIRED**; fonte `014_rls.sql:76`; SHA `2ba395934e0b`; risco: sem indicação estática
- `sub_own_profile_write` — **SECURITY_REVIEW_REQUIRED**; fonte `014_rls.sql:82`; SHA `242a3a33f96e`; risco: sem indicação estática
- `sub_own_consent` — **SECURITY_REVIEW_REQUIRED**; fonte `014_rls.sql:84`; SHA `e508ff305711`; risco: sem indicação estática
- `sub_insert_consent` — **SECURITY_REVIEW_REQUIRED**; fonte `014_rls.sql:87`; SHA `8af22ac0b26d`; risco: sem indicação estática
- `staff_read_account` — **SECURITY_REVIEW_REQUIRED**; fonte `014_rls.sql:125`; SHA `5a342c802915`; risco: ADMIN_OR_STAFF_POLICY
- `staff_read_profile` — **SECURITY_REVIEW_REQUIRED**; fonte `014_rls.sql:131`; SHA `9090d5c2654d`; risco: ADMIN_OR_STAFF_POLICY
- `staff_read_content` — **SECURITY_REVIEW_REQUIRED**; fonte `014_rls.sql:133`; SHA `21611c523f44`; risco: ADMIN_OR_STAFF_POLICY
- `staff_write_content` — **SECURITY_REVIEW_REQUIRED**; fonte `014_rls.sql:135`; SHA `a391529c797f`; risco: ADMIN_OR_STAFF_POLICY, BROAD_ALL_OPERATION
- `staff_read_version` — **SECURITY_REVIEW_REQUIRED**; fonte `014_rls.sql:137`; SHA `5402be673889`; risco: ADMIN_OR_STAFF_POLICY
- `staff_write_version` — **SECURITY_REVIEW_REQUIRED**; fonte `014_rls.sql:139`; SHA `d0c2d46155fb`; risco: ADMIN_OR_STAFF_POLICY, BROAD_ALL_OPERATION
- `staff_read_verification` — **SECURITY_REVIEW_REQUIRED**; fonte `014_rls.sql:141`; SHA `a33ca5cebabf`; risco: ADMIN_OR_STAFF_POLICY
- `staff_write_verification` — **SECURITY_REVIEW_REQUIRED**; fonte `014_rls.sql:143`; SHA `38bc26c8ff0e`; risco: ADMIN_OR_STAFF_POLICY, BROAD_ALL_OPERATION
- `staff_read_moderation` — **SECURITY_REVIEW_REQUIRED**; fonte `014_rls.sql:145`; SHA `cc087abeaafb`; risco: ADMIN_OR_STAFF_POLICY, BROAD_ALL_OPERATION
- `staff_read_grant` — **SECURITY_REVIEW_REQUIRED**; fonte `014_rls.sql:147`; SHA `ec786b7631f8`; risco: ADMIN_OR_STAFF_POLICY, BROAD_ALL_OPERATION
- `staff_insert_grant` — **SECURITY_REVIEW_REQUIRED**; fonte `014_rls.sql:149`; SHA `a1c4cca582da`; risco: ADMIN_OR_STAFF_POLICY
- `staff_read_audit` — **SECURITY_REVIEW_REQUIRED**; fonte `014_rls.sql:151`; SHA `d84dfd287ff2`; risco: ADMIN_OR_STAFF_POLICY
- `staff_insert_audit` — **SECURITY_REVIEW_REQUIRED**; fonte `014_rls.sql:153`; SHA `c94e15ea1f70`; risco: ADMIN_OR_STAFF_POLICY
- `staff_read_ops` — **SECURITY_REVIEW_REQUIRED**; fonte `014_rls.sql:155`; SHA `93cd63fe3d72`; risco: ADMIN_OR_STAFF_POLICY
- `admin_read_all_account` — **SECURITY_REVIEW_REQUIRED**; fonte `014_rls.sql:157`; SHA `18226dca829f`; risco: ADMIN_OR_STAFF_POLICY
- `admin_read_all_profile` — **SECURITY_REVIEW_REQUIRED**; fonte `014_rls.sql:160`; SHA `e281f83fed72`; risco: ADMIN_OR_STAFF_POLICY, BROAD_ALL_OPERATION
- `admin_all_learning` — **SECURITY_REVIEW_REQUIRED**; fonte `014_rls.sql:161`; SHA `44e426d8a74f`; risco: ADMIN_OR_STAFF_POLICY, BROAD_ALL_OPERATION
- `admin_all_mastery` — **SECURITY_REVIEW_REQUIRED**; fonte `014_rls.sql:163`; SHA `80a27725f027`; risco: ADMIN_OR_STAFF_POLICY, BROAD_ALL_OPERATION
- `admin_all_subscription` — **SECURITY_REVIEW_REQUIRED**; fonte `014_rls.sql:165`; SHA `eeb972b973a6`; risco: ADMIN_OR_STAFF_POLICY, BROAD_ALL_OPERATION
- `admin_all_ops` — **SECURITY_REVIEW_REQUIRED**; fonte `014_rls.sql:167`; SHA `e6b89e500d00`; risco: ADMIN_OR_STAFF_POLICY, BROAD_ALL_OPERATION
- `admin_all_integration` — **SECURITY_REVIEW_REQUIRED**; fonte `014_rls.sql:169`; SHA `36830acd7e8f`; risco: ADMIN_OR_STAFF_POLICY, BROAD_ALL_OPERATION
- `admin_all_grant` — **SECURITY_REVIEW_REQUIRED**; fonte `014_rls.sql:171`; SHA `33c071094376`; risco: ADMIN_OR_STAFF_POLICY, BROAD_ALL_OPERATION
- `pub_read_exam_track` — **SECURITY_REVIEW_REQUIRED**; fonte `018_provas_gabarito.sql:655`; SHA `d72d81efe2a4`; risco: sem indicação estática
- `pub_read_exam_form` — **SECURITY_REVIEW_REQUIRED**; fonte `018_provas_gabarito.sql:660`; SHA `59f88cf52a09`; risco: sem indicação estática
- `sub_read_exam_track` — **SECURITY_REVIEW_REQUIRED**; fonte `018_provas_gabarito.sql:662`; SHA `a2f021619f19`; risco: sem indicação estática
- `sub_read_exam_form` — **SECURITY_REVIEW_REQUIRED**; fonte `018_provas_gabarito.sql:665`; SHA `14e5340b6287`; risco: sem indicação estática
- `sub_read_exam_form_item` — **SECURITY_REVIEW_REQUIRED**; fonte `018_provas_gabarito.sql:667`; SHA `b100051e0a20`; risco: sem indicação estática
- `staff_read_exam_track` — **SECURITY_REVIEW_REQUIRED**; fonte `018_provas_gabarito.sql:669`; SHA `94696e63fda7`; risco: ADMIN_OR_STAFF_POLICY
- `staff_write_exam_track` — **SECURITY_REVIEW_REQUIRED**; fonte `018_provas_gabarito.sql:671`; SHA `cf8df28c40ff`; risco: ADMIN_OR_STAFF_POLICY, BROAD_ALL_OPERATION
- `staff_read_exam_form` — **SECURITY_REVIEW_REQUIRED**; fonte `018_provas_gabarito.sql:672`; SHA `84acab8fc469`; risco: ADMIN_OR_STAFF_POLICY
- `staff_write_exam_form` — **SECURITY_REVIEW_REQUIRED**; fonte `018_provas_gabarito.sql:673`; SHA `e86f1ba16226`; risco: ADMIN_OR_STAFF_POLICY, BROAD_ALL_OPERATION
- `staff_read_exam_form_item` — **SECURITY_REVIEW_REQUIRED**; fonte `018_provas_gabarito.sql:674`; SHA `a76d21b6d575`; risco: ADMIN_OR_STAFF_POLICY
- `staff_write_exam_form_item` — **SECURITY_REVIEW_REQUIRED**; fonte `018_provas_gabarito.sql:675`; SHA `b2852282a632`; risco: ADMIN_OR_STAFF_POLICY, BROAD_ALL_OPERATION
- `staff_read_answer_key` — **SECURITY_REVIEW_REQUIRED**; fonte `018_provas_gabarito.sql:676`; SHA `1de8d893376a`; risco: ADMIN_OR_STAFF_POLICY, ANSWER_KEY_ACCESS
- `staff_write_answer_key` — **SECURITY_REVIEW_REQUIRED**; fonte `018_provas_gabarito.sql:678`; SHA `7ac131cc39e4`; risco: ADMIN_OR_STAFF_POLICY, BROAD_ALL_OPERATION, ANSWER_KEY_ACCESS
- `staff_read_answer_key_entry` — **SECURITY_REVIEW_REQUIRED**; fonte `018_provas_gabarito.sql:679`; SHA `6fe476a56c41`; risco: ADMIN_OR_STAFF_POLICY, ANSWER_KEY_ACCESS
- `staff_write_answer_key_entry` — **SECURITY_REVIEW_REQUIRED**; fonte `018_provas_gabarito.sql:680`; SHA `e570660d05f2`; risco: ADMIN_OR_STAFF_POLICY, BROAD_ALL_OPERATION, ANSWER_KEY_ACCESS
- `admin_read_exam_track` — **SECURITY_REVIEW_REQUIRED**; fonte `018_provas_gabarito.sql:681`; SHA `60b27e4d11be`; risco: ADMIN_OR_STAFF_POLICY
- `admin_write_exam_track` — **SECURITY_REVIEW_REQUIRED**; fonte `018_provas_gabarito.sql:683`; SHA `9eed3e9d106e`; risco: ADMIN_OR_STAFF_POLICY, BROAD_ALL_OPERATION
- `admin_read_exam_form` — **SECURITY_REVIEW_REQUIRED**; fonte `018_provas_gabarito.sql:684`; SHA `0d270593f033`; risco: ADMIN_OR_STAFF_POLICY
- `admin_write_exam_form` — **SECURITY_REVIEW_REQUIRED**; fonte `018_provas_gabarito.sql:685`; SHA `25d82009362a`; risco: ADMIN_OR_STAFF_POLICY, BROAD_ALL_OPERATION
- `admin_read_exam_form_item` — **SECURITY_REVIEW_REQUIRED**; fonte `018_provas_gabarito.sql:686`; SHA `13bc55de410f`; risco: ADMIN_OR_STAFF_POLICY
- `admin_write_exam_form_item` — **SECURITY_REVIEW_REQUIRED**; fonte `018_provas_gabarito.sql:687`; SHA `2c7e496f5b8e`; risco: ADMIN_OR_STAFF_POLICY, BROAD_ALL_OPERATION
- `admin_read_answer_key` — **SECURITY_REVIEW_REQUIRED**; fonte `018_provas_gabarito.sql:688`; SHA `3183b059738b`; risco: ADMIN_OR_STAFF_POLICY, ANSWER_KEY_ACCESS
- `admin_write_answer_key` — **SECURITY_REVIEW_REQUIRED**; fonte `018_provas_gabarito.sql:689`; SHA `84fbc0327569`; risco: ADMIN_OR_STAFF_POLICY, BROAD_ALL_OPERATION, ANSWER_KEY_ACCESS
- `admin_read_answer_key_entry` — **SECURITY_REVIEW_REQUIRED**; fonte `018_provas_gabarito.sql:690`; SHA `2b2dfd121cb7`; risco: ADMIN_OR_STAFF_POLICY, ANSWER_KEY_ACCESS
- `admin_write_answer_key_entry` — **SECURITY_REVIEW_REQUIRED**; fonte `018_provas_gabarito.sql:691`; SHA `842bee5486fc`; risco: ADMIN_OR_STAFF_POLICY, BROAD_ALL_OPERATION, ANSWER_KEY_ACCESS
- `sub_own_attempt` — **SECURITY_REVIEW_REQUIRED**; fonte `019_tentativa_ingestao.sql:558`; SHA `6c1ceaae8d79`; risco: BROAD_ALL_OPERATION
- `sub_own_attempt_answer` — **SECURITY_REVIEW_REQUIRED**; fonte `019_tentativa_ingestao.sql:563`; SHA `10c2d38f0d39`; risco: BROAD_ALL_OPERATION
- `staff_read_item_option` — **SECURITY_REVIEW_REQUIRED**; fonte `026_staff_le_gabarito_default_zero.sql:44`; SHA `87e751ba1a19`; risco: ADMIN_OR_STAFF_POLICY
- `admin_read_item_option` — **SECURITY_REVIEW_REQUIRED**; fonte `026_staff_le_gabarito_default_zero.sql:49`; SHA `ff17de49931c`; risco: ADMIN_OR_STAFF_POLICY

## Verificações e escopo

- O gerador valida os 30 hashes, reconstrói cada declaração SQL com mesmo SHA e linha do inventário histórico, verifica a presença de candidatos e a classificação completa.
- Redefinições posteriores são listadas em `staged_name_overrides`. **A última DDL prevalecer em PG não significa equivalência com S22.**
- 13 políticas owner-only geraram 18 políticas mais restritas; as demais exigem revisão de ACL/RLS e nenhuma foi implicitamente promovida.
- Nenhum banco remoto, projeto Supabase, branch ou deploy é criado por este procedimento.
- F1 permanece **em andamento**: objetos não portados, segurança/admin, 2 views e funções de negócio requerem implementação e aceites posteriores.

### Reprodução

```bash
python3 tools/reconcile_s22_objects.py --root . --check
python3 -m unittest discover -s tests -p "test_ns01_object_reconciliation.py" -v
```

Registro completo: `inventories/s22/CANONE_NS01_OBJECT_RECONCILIATION.json`.
Diretriz: [Plano Supabase por último](PLANO_CONCLUSAO_SUPABASE_ULTIMO.md).
