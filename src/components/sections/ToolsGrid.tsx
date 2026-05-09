import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { tools } from "@/lib/tools";

export const ToolsGrid = () => (
  <section id="tools" className="py-20 sm:py-28 bg-subtle-gradient">
    <div className="container-tight">
      <div className="text-center max-w-2xl mx-auto mb-14">
        <p className="text-sm font-semibold text-primary mb-3">All-in-one toolkit</p>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
          Every PDF tool you need, in one place
        </h2>
        <p className="mt-4 text-muted-foreground">
          {tools.length}+ powerful tools that run instantly in your browser. No installation. No watermarks.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {tools.map((tool, i) => {
          const Icon = tool.icon;
          return (
            <motion.div
              key={tool.slug}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
            >
              <Link
                to={`/${tool.slug}`}
                className="group relative block h-full p-6 rounded-2xl border border-border bg-card hover:shadow-elegant transition-all duration-300 hover:-translate-y-1 overflow-hidden"
              >
                <div className={`absolute -top-12 -right-12 h-32 w-32 rounded-full bg-gradient-to-br ${tool.gradient} opacity-10 group-hover:opacity-20 blur-2xl transition-opacity`} />
                <div className={`relative h-12 w-12 rounded-xl bg-gradient-to-br ${tool.gradient} flex items-center justify-center shadow-soft mb-5`}>
                  <Icon className="h-6 w-6 text-white" strokeWidth={2.2} />
                </div>
                <h3 className="text-lg font-semibold mb-1.5">{tool.name}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{tool.tagline}</p>
                <div className="mt-5 flex items-center text-sm font-medium text-primary group-hover:gap-2 gap-1.5 transition-all">
                  Use tool
                  <ArrowUpRight className="h-4 w-4" />
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  </section>
);
