# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 08, section: kruskal
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# This teaching function is intentionally limited to three groups of size three.
kw_three_exact <- function(groups) {
  stopifnot(is.list(groups),length(groups)==3,
            all(lengths(groups)==3),all(is.finite(unlist(groups))))
  y <- unlist(groups,use.names=FALSE)
  group <- factor(rep(c("A","B","C"),each=3))
  N <- length(y)
  ranks <- rank(y,ties.method="average")
  doubled_ranks <- 2*ranks
  rank_sums <- as.numeric(tapply(ranks,group,sum))
  # Count equal numeric values directly, without converting them to labels.
  tie_sizes <- rle(sort(y))$lengths
  correction <- 1-sum(tie_sizes^3-tie_sizes)/(N^3-N)
  if (correction<=0) stop("All observations are tied: H/C is undefined.")
  raw_H <- 12/(N*(N+1))*sum(rank_sums^2/3)-3*(N+1)
  corrected_H <- raw_H/correction
  # With fixed sizes 3,3,3, S=sum((2*R_j)^2) and H=S/90-30.
  # Integer scores avoid floating-point ambiguity when including an equal boundary.
  observed_score <- sum((2*rank_sums)^2)
  expected_allocations <- choose(9,3)*choose(6,3)
  null_scores <- numeric(expected_allocations)
  allocation <- 0L
  for (A in combn(seq_len(N),3,simplify=FALSE)) {
    remaining <- setdiff(seq_len(N),A)
    for (B in combn(remaining,3,simplify=FALSE)) {
      C <- setdiff(remaining,B)
      allocation <- allocation+1L
      doubled_sums <- c(sum(doubled_ranks[A]),sum(doubled_ranks[B]),
                        sum(doubled_ranks[C]))
      null_scores[allocation] <- sum(doubled_sums^2)
    }
  }
  extreme <- sum(null_scores>=observed_score)
  exact_P <- extreme/allocation
  approx_P <- pchisq(corrected_H,df=2,lower.tail=FALSE)
  # Re-ranking pooled ranks is equivalent and avoids old R decimal-label merging.
  reference <- kruskal.test(split(ranks,group))
  stopifnot(allocation==1680,sum(rank_sums)==45,
            all(doubled_ranks==round(doubled_ranks)),
            abs(raw_H-(observed_score/90-30))<1e-12,
            abs(corrected_H-unname(reference$statistic))<1e-12,
            abs(approx_P-reference$p.value)<1e-12)
  list(rows=data.frame(record=seq_len(N),group=group,y=y,rank=ranks),
       summary=data.frame(R_A=rank_sums[1],R_B=rank_sums[2],R_C=rank_sums[3],
         C=correction,H=raw_H,H_corrected=corrected_H,df=2,
         chi_square_P=approx_P,extreme=extreme,allocations=allocation,
         exact_P=exact_P),
       score_frequency=as.data.frame(table(null_scores)),
       null_scores=null_scores)
}
# Compare the existing untied example with a new tied example.
untied_groups <- list(A=4:6,B=7:9,C=10:12)
tied_groups <- list(A=c(1,1,2),B=c(2,3,4),C=c(4,5,5))
untied <- kw_three_exact(untied_groups)
tied <- kw_three_exact(tied_groups)
print(untied$rows)
print(tied$rows)
comparison <- rbind(untied=untied$summary,tied=tied$summary)
print(comparison,digits=12)
# Frequencies retain how many label allocations produce each statistic.
print(tied$score_frequency,row.names=FALSE)
stopifnot(untied$summary$extreme==6,tied$summary$extreme==24,
          abs(untied$summary$exact_P-6/1680)<1e-12,
          abs(tied$summary$exact_P-24/1680)<1e-12,
          abs(tied$summary$C-29/30)<1e-12,
          abs(tied$summary$H_corrected-6.64367816091954)<1e-12)
# Relabeling groups changes direction labels, but not the omnibus statistic.
reversed <- kw_three_exact(tied_groups[c(3,2,1)])
stopifnot(abs(reversed$summary$H_corrected-tied$summary$H_corrected)<1e-12,
          reversed$summary$extreme==tied$summary$extreme)
# All-tied data have no defined corrected H; do not silently report a zero P.
all_tied <- tryCatch(kw_three_exact(rep(list(rep(2,3)),3)),error=identity)
stopifnot(inherits(all_tied,"error"))
# These are complete conditional enumerations, not Monte Carlo simulations.
